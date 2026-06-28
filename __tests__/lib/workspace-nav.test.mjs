import test from "node:test";
import assert from "node:assert/strict";

const {
  flattenNavSections,
  getRoleNavItems,
  roleNavSections,
  teacherPortalSections,
} = await import("../../lib/workspace/nav.ts");

test("admin nav puts messages near the top under Today", () => {
  const items = getRoleNavItems("admin");
  const messagesIndex = items.findIndex(
    (item) => item.href === "/app/messages",
  );
  const usersIndex = items.findIndex(
    (item) => item.href === "/app/admin/users",
  );
  const auditIndex = items.findIndex(
    (item) => item.href === "/app/admin/audit",
  );

  assert.ok(messagesIndex >= 0);
  assert.ok(messagesIndex < usersIndex);
  assert.ok(messagesIndex < auditIndex);
});

test("admin nav sections group daily tools separately from school setup", () => {
  const sections = roleNavSections.admin;
  assert.equal(sections[0].label, "Today");
  assert.match(
    sections[0].items.map((item) => item.href).join(","),
    /\/app\/messages/,
  );
  assert.equal(sections.at(-1)?.label, "School & system");
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
      (item) => item.href === "/app/teacher/notifications",
    ),
  );
  assert.ok(studentItems.some((item) => item.href === "/app/student"));

  assert.ok(!teacherPortalItems.some((item) => item.href === "/teacher"));
  assert.ok(!teacherPortalItems.some((item) => item.href === "/teacher/inbox"));
  assert.ok(!studentItems.some((item) => item.href === "/student"));
});
