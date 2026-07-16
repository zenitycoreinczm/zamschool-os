import test from "node:test";
import assert from "node:assert/strict";

import {
  staffTodayItems,
  roleNavSections,
} from "../../lib/workspace/nav.ts";

test("staffTodayItems builds a consistent school feed strip", () => {
  const items = staffTodayItems({
    homeHref: "/app/deputy-head",
    homeLabel: "Quality Hub",
  });
  const hrefs = items.map((i) => i.href);
  assert.deepEqual(hrefs, [
    "/app/deputy-head",
    "/app/messages",
    "/app/notifications",
    "/app/announcements",
    "/app/events",
  ]);
  assert.equal(items[0].label, "Quality Hub");
});

test("deputy and guidance nav include Today feed + role tools", () => {
  const deputy = roleNavSections.deputy_head.flatMap((s) => s.items);
  const guidance = roleNavSections.guidance_office.flatMap((s) => s.items);

  assert.ok(deputy.some((i) => i.href === "/app/events"));
  assert.ok(deputy.some((i) => i.href === "/app/admin/timetable"));
  assert.ok(guidance.some((i) => i.href === "/app/discipline-admin"));
  assert.ok(guidance.some((i) => i.href === "/app/announcements"));
});

test("principal nav uses invite staff, not users directory", () => {
  const principal = roleNavSections.principal.flatMap((s) => s.items);
  assert.ok(principal.some((i) => i.href === "/app/principal/staff"));
  assert.ok(!principal.some((i) => i.href === "/app/admin/users"));
});

test("legacy admin nav uses invite staff, not users directory", () => {
  const admin = roleNavSections.admin.flatMap((s) => s.items);
  assert.ok(admin.some((i) => i.href === "/app/principal/staff"));
  assert.ok(!admin.some((i) => i.href === "/app/admin/users"));
});

test("payments settings points at role settings path", () => {
  const payments = roleNavSections.payments.flatMap((s) => s.items);
  assert.ok(payments.some((i) => i.href === "/app/payments/settings"));
  assert.ok(!payments.some((i) => i.href === "/app/settings"));
});
