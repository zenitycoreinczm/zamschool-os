import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  buildRoleMobileDock,
  getRoleSettingsPath,
  roleNavSections,
} from "../../lib/workspace/nav.ts";

const ROOT = process.cwd();

/** Map a nav href under /app/* to an expected page.tsx path. */
function pagePathForHref(href) {
  const path = href.split("?")[0];
  if (!path.startsWith("/app/")) return null;
  const rel = path.replace(/^\/app\//, "");
  const candidates = [
    join(ROOT, "app", "app", rel, "page.tsx"),
    join(ROOT, "app", "app", `${rel}.tsx`),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const STAFF_ROLES = [
  "principal",
  "deputy_head",
  "bursar",
  "guidance_office",
  "academic_admin",
  "hr_admin",
  "ict_admin",
  "discipline_admin",
  "registrar",
  "payments",
];

test("staff role nav hrefs resolve to real app pages", () => {
  const missing = [];

  for (const role of STAFF_ROLES) {
    const sections = roleNavSections[role] || [];
    for (const section of sections) {
      for (const item of section.items) {
        if (!item.href.startsWith("/app/")) continue;
        const found = pagePathForHref(item.href);
        if (!found) {
          missing.push(`${role}: ${item.href}`);
        }
      }
    }
  }

  assert.deepEqual(
    missing,
    [],
    `Missing pages for nav hrefs:\n${missing.join("\n")}`,
  );
});

test("specialty mobile dock Settings uses role settings path", () => {
  for (const role of [
    "deputy_head",
    "guidance_office",
    "ict_admin",
    "bursar",
    "payments",
  ]) {
    const dock = buildRoleMobileDock(role);
    const settings = dock.find((i) => i.label === "Settings");
    assert.ok(settings, `${role} dock should include Settings`);
    assert.equal(
      settings.href,
      getRoleSettingsPath(role),
      `${role} dock Settings should match role settings path`,
    );
  }
});
