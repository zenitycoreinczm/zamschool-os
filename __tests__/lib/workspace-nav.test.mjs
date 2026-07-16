import test from "node:test";
import assert from "node:assert/strict";

const {
  flattenNavSections,
  getRoleNavItems,
  getRoleDashboardPath,
  roleNavSections,
  teacherPortalSections,
  ROLE_DASHBOARD_PATHS,
} = await import("../../lib/workspace/nav.ts");

test("legacy admin nav matches Head Teacher (no Users directory)", () => {
  const adminItems = getRoleNavItems("admin");
  const principalItems = getRoleNavItems("principal");
  const messagesIndex = adminItems.findIndex(
    (item) => item.href === "/app/messages",
  );
  const staffIndex = adminItems.findIndex(
    (item) => item.href === "/app/principal/staff",
  );
  const auditIndex = adminItems.findIndex(
    (item) => item.href === "/app/admin/audit",
  );

  assert.ok(messagesIndex >= 0);
  assert.ok(staffIndex >= 0);
  assert.ok(messagesIndex < staffIndex);
  assert.ok(messagesIndex < auditIndex);
  assert.ok(!adminItems.some((item) => item.href === "/app/admin/users"));
  assert.deepEqual(
    adminItems.map((i) => i.href),
    principalItems.map((i) => i.href),
  );
});

test("admin nav sections match Head Teacher workspace groups", () => {
  const sections = roleNavSections.admin;
  assert.equal(sections[0].label, "Today");
  assert.match(
    sections[0].items.map((item) => item.href).join(","),
    /\/app\/messages/,
  );
  assert.equal(sections.at(-1)?.label, "Account");
  assert.ok(
    !sections
      .flatMap((s) => s.items)
      .some((item) => item.href === "/app/admin/users"),
  );
});

test("flattenNavSections dedupes repeated routes", () => {
  const items = flattenNavSections([
    {
      label: "A",
      items: [
        { href: "/app/messages", label: "Messages", icon: () => null },
        {
          href: "/app/messages",
          label: "Messages duplicate",
          icon: () => null,
        },
      ],
    },
  ]);

  assert.equal(items.length, 1);
});

test("teacher and student nav sections use mounted /app workspace routes", () => {
  const teacherPortalItems = flattenNavSections(teacherPortalSections);
  const studentItems = getRoleNavItems("student");

  assert.ok(teacherPortalItems.some((item) => item.href === "/app/teacher"));
  assert.ok(
    teacherPortalItems.some((item) => item.href === "/app/teacher/inbox"),
  );
  assert.ok(
    teacherPortalItems.some(
      (item) => item.href === "/app/teacher/settings",
    ),
  );
  assert.ok(
    teacherPortalItems.some(
      (item) => item.href === "/app/teacher/assignments",
    ),
  );
  assert.ok(
    teacherPortalItems.some((item) => item.href === "/app/teacher/teaching"),
  );
  assert.ok(
    !teacherPortalItems.some((item) => item.href === "/app/admin/timetable"),
  );
  assert.ok(studentItems.some((item) => item.href === "/app/student"));

  assert.ok(!teacherPortalItems.some((item) => item.href === "/teacher"));
  assert.ok(!teacherPortalItems.some((item) => item.href === "/teacher/inbox"));
  assert.ok(!studentItems.some((item) => item.href === "/student"));
});

test("ROLE_DASHBOARD_PATHS gives each role a canonical dashboard route", () => {
  // Legacy admin collapses into Head Teacher home.
  assert.equal(ROLE_DASHBOARD_PATHS.admin, "/app/principal");
  assert.equal(ROLE_DASHBOARD_PATHS.teacher, "/app/teacher");
  assert.equal(ROLE_DASHBOARD_PATHS.student, "/app/student");
  assert.equal(ROLE_DASHBOARD_PATHS.parent, "/app/parent");
  assert.equal(ROLE_DASHBOARD_PATHS.payments, "/app/payments");
  assert.equal(ROLE_DASHBOARD_PATHS.principal, "/app/principal");

  // First nav item per role should match the canonical dashboard route.
  for (const role of Object.keys(ROLE_DASHBOARD_PATHS)) {
    const expected = ROLE_DASHBOARD_PATHS[role];
    const first = getRoleNavItems(role)[0];
    assert.ok(first, `no nav items for role ${role}`);
    assert.equal(
      first.href,
      expected,
      `first nav entry for ${role} should point at ${expected}, got ${first.href}`,
    );
    assert.equal(getRoleDashboardPath(role), expected);
  }
});
