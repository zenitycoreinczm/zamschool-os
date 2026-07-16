import test from "node:test";
import assert from "node:assert/strict";

const {
  resolveRoleAwareProtectedPath,
  resolveUsersDirectoryRedirect,
} = await import("../../lib/auth-routing.ts");

test("legacy /app/admin/users redirects Head Teacher to Invite staff", () => {
  assert.equal(
    resolveUsersDirectoryRedirect("principal"),
    "/app/principal/staff",
  );
  assert.equal(
    resolveUsersDirectoryRedirect("admin"),
    "/app/principal/staff",
  );
  assert.equal(
    resolveRoleAwareProtectedPath("PRINCIPAL", "/app/admin/users"),
    "/app/principal/staff",
  );
  assert.equal(
    resolveRoleAwareProtectedPath("admin", "/app/admin/users?role=teacher"),
    "/app/principal/staff",
  );
});

test("legacy users path routes other desks to their owned pages", () => {
  assert.equal(
    resolveRoleAwareProtectedPath("HR_ADMIN", "/app/admin/users"),
    "/app/hr-admin/directory",
  );
  assert.equal(
    resolveRoleAwareProtectedPath("ICT_ADMIN", "/app/admin/users"),
    "/app/ict-admin/recovery",
  );
  assert.equal(
    resolveRoleAwareProtectedPath("REGISTRAR", "/app/admin/users"),
    "/app/registrar/people",
  );
});
