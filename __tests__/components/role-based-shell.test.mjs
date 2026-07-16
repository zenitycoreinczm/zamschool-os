import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = await readFile(
  resolve(process.cwd(), "components/RoleBasedShell.tsx"),
  "utf8",
);

test("RoleBasedShell maps super_admin to AdminShell without warn path", () => {
  assert.match(source, /ADMIN_SHELL_ROLES/);
  assert.match(source, /"super_admin"/);
  assert.match(source, /ADMIN_SHELL_ROLES\.has\(role\)/);
  // Fallback warn must be once-per-role, not every render.
  assert.match(source, /warnedUnmappedRoles/);
  // super_admin is intentional AdminShell - not an unmapped gap.
  assert.ok(
    /ADMIN_SHELL_ROLES[\s\S]*super_admin/.test(source),
    "super_admin must be listed in ADMIN_SHELL_ROLES",
  );
});

test("RoleBasedShell still routes teacher/parent/student/payments shells", () => {
  assert.match(source, /role === "teacher"/);
  assert.match(source, /role === "parent"/);
  assert.match(source, /role === "student"/);
  assert.match(source, /role === "payments"/);
});
