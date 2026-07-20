import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ─── Staff invitation regression tests ─────────────────────────────────────
//
// Verifies the registrar role constraint migration, the accepted_at fix,
// the revoke fix, and the standalone page fixes.

const invitationsSource = readFileSync(
  "app/api/staff/invitations/route.ts",
  "utf8",
);
const adminUsersSource = readFileSync("app/api/admin/users/route.ts", "utf8");
const adminInvitationsSource = readFileSync(
  "app/api/admin/staff/invitations/route.ts",
  "utf8",
);
const accountCreatePolicySource = readFileSync(
  "lib/account-create-policy.ts",
  "utf8",
);
const permissionDefaultsSource = readFileSync(
  "lib/permission-group-defaults.ts",
  "utf8",
);
const schoolInitializationSource = readFileSync(
  "lib/school-initialization.ts",
  "utf8",
);
const standalonePageSource = readFileSync(
  "app/app/admin/staff-invitations/page.tsx",
  "utf8",
);
const staffInvitationsViewSource = readFileSync(
  "components/staff/StaffInvitationsView.tsx",
  "utf8",
);

// ── Migration tests ──

const migrationsDir = "supabase/migrations";
const migrationFiles = readdirSync(migrationsDir).filter(
  (f) => f.endsWith(".sql") && f !== "00000000000000_baseline.sql",
);

const registrarMigration = migrationFiles.find((f) =>
  /registrar.*role|role.*registrar/i.test(f),
);

const permissionSyncMigration = migrationFiles.find((f) =>
  /sync.*staff.*permission|permission.*groups/i.test(f),
);

test("registrar role constraint migration exists", () => {
  assert.ok(
    registrarMigration,
    "Expected a migration file adding registrar to role constraints",
  );
});

if (registrarMigration) {
  const migrationContent = readFileSync(
    join(migrationsDir, registrarMigration),
    "utf8",
  );

  test("migration adds registrar to profiles_role_check", () => {
    assert.match(migrationContent, /profiles_role_check/);
    assert.match(migrationContent, /registrar/);
  });

  test("migration adds registrar to staff_invitations_role_check", () => {
    assert.match(migrationContent, /staff_invitations_role_check/);
    assert.match(migrationContent, /registrar/);
  });

  test("migration adds registrar to permission_group_roles_role_check", () => {
    assert.match(migrationContent, /permission_group_roles_role_check/);
    assert.match(migrationContent, /registrar/);
  });
}

test("permission sync migration repairs staff permission groups for existing schools", () => {
  assert.ok(
    permissionSyncMigration,
    "Expected a migration that syncs default staff permission groups for existing schools",
  );
  const migrationContent = readFileSync(
    join(migrationsDir, permissionSyncMigration),
    "utf8",
  );

  for (const role of [
    "principal",
    "deputy_head",
    "hr_admin",
    "academic_admin",
    "ict_admin",
    "registrar",
  ]) {
    assert.match(migrationContent, new RegExp(role));
  }

  for (const feature of [
    "users",
    "classes",
    "subjects",
    "audit",
    "sessions",
    "academic_years",
    "terms",
    "timetable",
    "grading_scales",
  ]) {
    assert.match(migrationContent, new RegExp(feature));
  }

  assert.match(migrationContent, /on conflict \(school_id, name\) do update/i);
  assert.match(
    migrationContent,
    /on conflict \(group_id, feature_key\) do update/i,
  );
});

// ── Permission and rate-limit workflow tests ──

test("Head Teacher can invite essential school staff roles", () => {
  for (const role of [
    "deputy_head",
    "hr_admin",
    "academic_admin",
    "ict_admin",
    "registrar",
  ]) {
    assert.match(invitationsSource, new RegExp(`\\"${role}\\"`));
    assert.match(accountCreatePolicySource, new RegExp(`\\"${role}\\"`));
  }

  assert.match(
    invitationsSource,
    /STAFF_INVITATION_ROLES\s*=\s*\[[\s\S]*?"PRINCIPAL"[\s\S]*?\]/,
    "STAFF_INVITATION_ROLES must include Head Teacher",
  );
  assert.match(
    invitationsSource,
    /allowedRoles:\s*\[\.\.\.STAFF_INVITATION_ROLES\]/,
    "Staff invitation handlers must reference STAFF_INVITATION_ROLES via spread",
  );
  assert.match(
    accountCreatePolicySource,
    /actor === "PRINCIPAL"[\s\S]*?return true/,
    "Head Teacher must be able to create non-blocked school roles",
  );
});

test("domain staff defaults grant their required backend features", () => {
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["PRINCIPAL"\][\s\S]*?full\("users"\)/,
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["REGISTRAR"\][\s\S]*?writable\("users"\)/,
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["REGISTRAR"\][\s\S]*?writable\("classes"\)/,
    "Registrar creates and manages classes",
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["ACADEMIC_ADMIN"\][\s\S]*?readOnly\("classes"\)/,
    "Academic Admin no longer creates classes - the Registrar owns class creation",
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["ACADEMIC_ADMIN"\][\s\S]*?full\("subjects"\)/,
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["ACADEMIC_ADMIN"\][\s\S]*?full\("timetable"\)/,
    "Academic Admin must be able to create class and teacher timetables",
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["ICT_ADMIN"\][\s\S]*?full\("settings"\)/,
    "ICT Admin can manage account and security settings",
  );
  assert.match(
    permissionDefaultsSource,
    /roles:\s*\["ICT_ADMIN"\][\s\S]*?readOnly\("audit"\)/,
  );
});

test("school initialization repairs existing DB permission rows", () => {
  assert.match(
    schoolInitializationSource,
    /upsert\([\s\S]*onConflict:\s*"school_id,name"/,
  );
  assert.match(
    schoolInitializationSource,
    /upsert\([\s\S]*onConflict:\s*"group_id,role"/,
  );
  assert.match(
    schoolInitializationSource,
    /upsert\([\s\S]*onConflict:\s*"group_id,feature_key"/,
  );
  assert.match(schoolInitializationSource, /invalidateSchoolPermissionCache/);
  assert.doesNotMatch(
    schoolInitializationSource,
    /results\.permissions\s*=\s*\{\s*status:\s*"skipped"/,
    "Initialization must not skip permission repair when groups already exist",
  );
});

test("authenticated user writes use actor-scoped rate limit keys", () => {
  assert.match(invitationsSource, /(?:tenantActorRateLimitKey|buildActorRateLimitKey)\(/);
  assert.match(adminUsersSource, /(?:tenantActorRateLimitKey|buildActorRateLimitKey)\(/);
  assert.doesNotMatch(adminUsersSource, /key:\s*`admin-users:\$\{ip\}`/);
  assert.doesNotMatch(
    invitationsSource,
    /key:\s*`invitations:\$\{access\.context\.schoolId\}:\$\{ip\}`/,
  );
});

test("registrar can create student, parent, and teacher records", () => {
  assert.match(
    accountCreatePolicySource,
    /actor === "REGISTRAR"[\s\S]*target === "student"[\s\S]*target === "parent"[\s\S]*target === "teacher"/,
  );
});

// ── accepted_at fix tests ──

test("POST handler does not set accepted_at at creation time", () => {
  const postMatch = invitationsSource.match(
    /export async function POST[\s\S]*?\.from\(\s*["']staff_invitations["']\s*\)\s*\.insert\([\s\S]*?\)/,
  );
  assert.ok(postMatch, "POST handler must insert into staff_invitations");
  assert.doesNotMatch(
    postMatch[0],
    /accepted_at:\s*nowIso/,
    "POST must not set accepted_at at creation - it breaks pending listings, revoke, and accept",
  );
  assert.doesNotMatch(
    postMatch[0],
    /accepted_at:\s*new Date/,
    "POST must not set accepted_at at creation",
  );
});

test("POST handler sets status to 'accepted' instead of accepted_at", () => {
  // Search the full source - the insert block has status: "accepted"
  assert.match(
    invitationsSource,
    /status:\s*["']accepted["']/,
    "POST should set status to 'accepted' to reflect the direct-create flow",
  );
});

// ── Revoke fix tests ──

test("DELETE handler filters on revoked_at IS NULL (not accepted_at)", () => {
  const deleteMatch = invitationsSource.match(
    /export async function DELETE[\s\S]*?\n}/,
  );
  assert.ok(deleteMatch, "DELETE handler must exist");
  assert.doesNotMatch(
    deleteMatch[0],
    /\.is\(\s*["']accepted_at["']\s*,\s*null\)/,
    "DELETE must not filter on accepted_at IS NULL - that field is no longer set at creation",
  );
  assert.match(
    deleteMatch[0],
    /\.is\(\s*["']revoked_at["']\s*,\s*null\)/,
    "DELETE must filter on revoked_at IS NULL to find non-revoked invitations",
  );
});

test("DELETE handler updates status to 'cancelled' (schema CHECK value)", () => {
  const deleteMatch = invitationsSource.match(
    /export async function DELETE[\s\S]*?\n}/,
  );
  assert.ok(deleteMatch);
  // staff_invitations_status_check allows: pending | accepted | expired | cancelled
  // "revoked" is NOT valid and causes a 500 on revoke.
  assert.match(
    deleteMatch[0],
    /status:\s*["']cancelled["']/,
    "DELETE should set status to 'cancelled' (not 'revoked')",
  );
  assert.doesNotMatch(
    deleteMatch[0],
    /status:\s*["']revoked["']/,
    "DELETE must not set status to 'revoked' - that violates the CHECK constraint",
  );
});

// ── GET filter fix tests ──

test("GET handler 'pending' filter uses revoked_at (not accepted_at)", () => {
  // Extract just the GET function to avoid matching the POST handler's
  // duplicate check which still uses accepted_at IS NULL
  const getMatch = invitationsSource.match(
    /export async function GET[\s\S]*?\n}/,
  );
  assert.ok(getMatch, "GET handler must exist");
  const getBody = getMatch[0];
  assert.doesNotMatch(
    getBody,
    /\.is\(\s*["']accepted_at["']\s*,\s*null\)/,
    "GET 'pending' filter must not use accepted_at IS NULL",
  );
  assert.match(
    getBody,
    /status === ["']pending["'][\s\S]*?\.is\(\s*["']revoked_at["']\s*,\s*null\)/,
    "GET 'pending' filter must use revoked_at IS NULL",
  );
});

test("admin GET handler 'pending' filter uses revoked_at (not accepted_at)", () => {
  assert.doesNotMatch(
    adminInvitationsSource,
    /status === ["']pending["'][\s\S]*?\.is\(\s*["']accepted_at["']\s*,\s*null\)/,
    "admin GET 'pending' filter must not use accepted_at IS NULL",
  );
});

// ── Standalone page fix tests ──

test("standalone page uses STAFF_INVITE_ROLE_OPTIONS (no school administrator)", () => {
  assert.match(
    standalonePageSource,
    /StaffInvitationsView/,
    "standalone page must render StaffInvitationsView",
  );
  assert.match(
    staffInvitationsViewSource,
    /STAFF_INVITE_ROLE_OPTIONS/,
    "StaffInvitationsView must use the shared role options list",
  );
  assert.doesNotMatch(
    staffInvitationsViewSource,
    /const INVITE_ROLES = \[/,
    "StaffInvitationsView must not hardcode its own role list",
  );
  assert.doesNotMatch(
    staffInvitationsViewSource,
    /Invite School Administrator/,
    "School Administrator invite was removed; Head Teacher is registration-only",
  );
});

test("standalone page shows the temporary password after creation", () => {
  assert.match(
    staffInvitationsViewSource,
    /temporary_password/,
    "StaffInvitationsView must capture and display the temporary password from the API response",
  );
  assert.match(
    staffInvitationsViewSource,
    /lastCreatedPassword/,
    "StaffInvitationsView must track the last created password",
  );
});

// ── Offline sync queue auth fix ──

test("offline sync queue includes credentials and CSRF token", () => {
  const queueSource = readFileSync("lib/offline-sync-queue.ts", "utf8");
  assert.match(
    queueSource,
    /credentials:\s*["']same-origin["']/,
    "offline sync queue must use same-origin credentials for auth cookies",
  );
  assert.match(
    queueSource,
    /X-CSRF-Token/,
    "offline sync queue must inject CSRF token for mutating requests",
  );
});
