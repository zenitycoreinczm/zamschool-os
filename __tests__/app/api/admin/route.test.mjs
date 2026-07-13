import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { importTsModule } from "../../../../scripts/test-ts-module.mjs";

const { buildCreatedAuthUserMetadata, buildCreatedProfilePayload } =
  await importTsModule("../../../../lib/account-state.ts", import.meta.url);
const { mapUniqueViolationToUserCreateConflict } = await importTsModule(
  "../../../../lib/user-create-conflicts.ts",
  import.meta.url,
);

const pagePath = resolve(
  process.cwd(),
  "components",
  "admin",
  "users",
  "AdminUsersPage.tsx",
);
const usersUiDir = resolve(process.cwd(), "components", "admin", "users");

async function readUsersUiSurface() {
  const { readdir } = await import("node:fs/promises");
  const names = await readdir(usersUiDir);
  const sources = await Promise.all(
    names
      .filter((name) => /\.(tsx?|jsx?)$/.test(name))
      .map((name) => readFile(resolve(usersUiDir, name), "utf8")),
  );
  return sources.join("\n");
}
const routePath = resolve(
  process.cwd(),
  "app",
  "api",
  "admin",
  "users",
  "route.ts",
);
const usersHelpersPath = resolve(
  process.cwd(),
  "app",
  "api",
  "admin",
  "users",
  "helpers.ts",
);
const usersSchemasPath = resolve(
  process.cwd(),
  "app",
  "api",
  "admin",
  "users",
  "schemas.ts",
);

async function readUsersApiSurface() {
  const [route, helpers, schemas] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(usersHelpersPath, "utf8"),
    readFile(usersSchemasPath, "utf8"),
  ]);
  return `${route}\n${helpers}\n${schemas}`;
}
const teacherDetailPath = resolve(
  process.cwd(),
  "lib",
  "teacher-account-detail.ts",
);
const teacherDetailBuilderPath = resolve(
  process.cwd(),
  "lib",
  "teacher-account-detail-builder.ts",
);
const resetPasswordRoutePath = resolve(
  process.cwd(),
  "app",
  "api",
  "admin",
  "users",
  "reset-password",
  "route.ts",
);

test("admin user route sets first-login flags for managed roles", () => {
  const now = new Date("2026-03-19T12:34:56.000Z");

  for (const role of ["student", "teacher", "parent"]) {
    const payload = buildCreatedProfilePayload({
      authUserId: `${role}-id`,
      schoolId: "school-1",
      role,
      firstName: "Test",
      lastName: "User",
      email: `${role}@example.com`,
      phone: null,
      profileExtras: {},
      now,
    });

    assert.equal(
      payload.must_change_password,
      true,
      `${role} should require a first-login password change`,
    );
    assert.equal(
      payload.temporary_password_issued_at,
      now.toISOString(),
      `${role} should get a temporary password issued timestamp`,
    );
  }
});

test("school admin accounts follow the same first-login password reset policy", () => {
  const now = new Date("2026-03-19T12:34:56.000Z");

  const payload = buildCreatedProfilePayload({
    authUserId: "admin-id",
    schoolId: "school-1",
    role: "admin",
    firstName: "Admin",
    lastName: "User",
    email: "admin@example.com",
    phone: null,
    profileExtras: {},
    now,
  });

  assert.equal(payload.must_change_password, true);
  assert.equal(payload.temporary_password_issued_at, now.toISOString());
});

test("managed user payloads keep gender metadata for dashboard splits", () => {
  const payload = buildCreatedProfilePayload({
    authUserId: "student-id",
    schoolId: "school-1",
    role: "student",
    firstName: "Ada",
    lastName: "Zulu",
    email: "ada@example.com",
    phone: null,
    profileExtras: {
      gender: "FEMALE",
    },
  });

  assert.equal(payload.gender, "FEMALE");
});

test("teacher profile payload omits hire_date (teachers table only)", () => {
  const payload = buildCreatedProfilePayload({
    authUserId: "teacher-id",
    schoolId: "school-1",
    role: "teacher",
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: null,
    profileExtras: {
      employee_id: "EMP-1",
      department: "Science",
      specialization: "Biology",
      hire_date: "2024-01-15",
    },
  });

  assert.equal(payload.employee_id, "EMP-1");
  assert.equal(payload.department, "Science");
  assert.equal(payload.specialization, "Biology");
  assert.equal(
    Object.prototype.hasOwnProperty.call(payload, "hire_date"),
    false,
    "hire_date must not be written to profiles (causes PGRST204)",
  );
});

test("admin user create maps unique constraint errors to friendly 409 conflicts", () => {
  const studentNumber = mapUniqueViolationToUserCreateConflict({
    code: "23505",
    details: "Key (student_number)=(1) already exists.",
    message:
      'duplicate key value violates unique constraint "students_student_number_key"',
  });
  assert.equal(studentNumber?.status, 409);
  assert.equal(studentNumber?.code, "duplicate_student_number");
  assert.equal(studentNumber?.field, "admissionNumber");
  assert.match(studentNumber?.error || "", /student number/i);

  const profilePk = mapUniqueViolationToUserCreateConflict({
    code: "23505",
    details: "Key (id)=(8788fadd-c148-4d8f-b810-2acfe95339e0) already exists.",
    message:
      'duplicate key value violates unique constraint "profiles_pkey"',
  });
  assert.equal(profilePk?.status, 409);
  assert.equal(profilePk?.code, "duplicate_profile");
  assert.equal(profilePk?.field, "email");
  assert.match(profilePk?.error || "", /email already exists/i);

  const other = mapUniqueViolationToUserCreateConflict({
    code: "42P01",
    message: "relation does not exist",
  });
  assert.equal(other, null);
});

test("admin users POST handles create conflicts and preflight uniqueness", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /findUserCreateConflict/);
  assert.match(source, /mapUniqueViolationToUserCreateConflict/);
  assert.match(source, /conflictResponse/);
  assert.match(source, /rollbackCreatedUser/);
});

test("auth metadata carries the first-login fallback flag", () => {
  const teacherMetadata = buildCreatedAuthUserMetadata({
    firstName: "Teacher",
    lastName: "User",
    role: "teacher",
  });
  const adminMetadata = buildCreatedAuthUserMetadata({
    firstName: "Admin",
    lastName: "User",
    role: "admin",
  });

  assert.equal(teacherMetadata.must_change_password, true);
  assert.equal(adminMetadata.must_change_password, true);
});

test("admin users page explains the temporary password flow", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /one-time\s+temporary password/i);
  assert.match(source, /first\s+login/);
  assert.match(source, /Temporary Password \(one-time\)/);
});

test("admin users page captures gender during managed account creation", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /label="Gender"/);
  assert.match(source, /form\.gender/);
});

test("admin users route accepts and normalizes gender profile extras", async () => {
  const source = await readUsersApiSurface();

  assert.match(source, /gender/);
  assert.match(source, /normalizeProfileGender/);
  assert.match(source, /is_active/);
});

test("admin users route uses actor-scoped rate limiting and fails open if Redis is unavailable", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /(?:tenantActorRateLimitKey|buildActorRateLimitKey)\(/);
  assert.match(source, /(?:`admin-users:\$\{schoolId\}`|scope:\s*["']admin-users["'])/);
  assert.match(source, /(?:`admin-users-update:\$\{schoolId\}`|scope:\s*["']admin-users-update["'])/);
  assert.doesNotMatch(source, /key:\s*`admin-users:\$\{ip\}`/);
  assert.doesNotMatch(source, /key:\s*`admin-users-update:\$\{ip\}`/);
  assert.match(source, /failOpen:\s*true/);
});

test("admin users route exposes a GET detail endpoint for mobile drill-down", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /export async function GET/);
  assert.match(source, /searchParams\.get\("profileId"\)/);
});

test("admin users route supports admin people drill-down details", async () => {
  const routeSource = await readUsersApiSurface();
  const teacherDetailSource = await readFile(teacherDetailPath, "utf8");

  assert.match(routeSource, /export async function GET/);
  assert.match(routeSource, /loadTeacherAccountDetail/);
  assert.match(routeSource, /buildStudentDetail/);
  assert.match(routeSource, /buildParentDetail/);
  assert.match(teacherDetailSource, /from\("attendance"\)/);
  assert.match(teacherDetailSource, /from\("lessons"\)/);
  assert.match(teacherDetailSource, /from\("assignments"\)/);
  assert.match(routeSource, /parent_students/);
});

test("admin users route builds a teacher oversight dossier for admin drill-down", async () => {
  const teacherDetailSource = await readFile(teacherDetailPath, "utf8");
  const builderSource = await readFile(teacherDetailBuilderPath, "utf8");

  assert.match(builderSource, /buildTeacherOversightDossier/);
  assert.match(builderSource, /buildTeacherTenure/);
  assert.match(teacherDetailSource, /from\("assignments"\)/);
  assert.match(teacherDetailSource, /from\("results"\)/);
  assert.match(teacherDetailSource, /from\("classes"\)/);
});

test("admin users page exposes a teacher details action", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /View details for/);
  assert.match(source, /Teacher oversight/);
  assert.match(source, /\/api\/admin\/users\?profileId=/);
});

test("admin users route can reissue temporary passwords for managed accounts", async () => {
  const source = await readFile(resetPasswordRoutePath, "utf8");

  assert.match(source, /export async function POST/);
  assert.match(source, /createOrUpdateAuthUserWithTemporaryPassword/);
  assert.match(source, /must_change_password:\s*true/);
  assert.match(source, /temporary_password_issued_at/);
});

test("admin users route supports managed account edits through PUT", async () => {
  const source = await readFile(routePath, "utf8");

  assert.match(source, /export async function PUT/);
  assert.match(source, /buildUserWritePlan/);
  assert.match(source, /safeUpdateScoped\(\s*"profiles"/);
  assert.match(source, /loadStudentRecord/);
  assert.match(source, /loadTeacherRecord/);
  assert.match(source, /loadParentRecord/);
});

test("admin users route PUT writes an updated audit log", async () => {
  const source = await readFile(routePath, "utf8");

  // Bug fix (2026-06-21): PUT was missing an audit-log call.
  assert.match(source, /export async function PUT/);
  assert.match(source, /action:\s*"user\.updated"/);
  assert.match(source, /auditDomainWrite/);
  assert.match(source, /entityType:\s*"profiles"/);
});

test("admin users page exposes a reset temporary password action", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /Reset temporary password/);
  assert.match(source, /\/api\/admin\/users\/reset-password/);
});

test("reset password route repairs managed accounts that are missing auth users", async () => {
  const source = await readFile(resetPasswordRoutePath, "utf8");

  assert.match(source, /createOrUpdateAuthUserWithTemporaryPassword/);
  assert.match(source, /authUserId:\s*profile\.id/);
  assert.match(source, /must_change_password:\s*true/);
});

test("admin users page routes parent-student linking through the admin relationships API", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /\/api\/admin\/relationships/);
  assert.match(source, /"link_parent_student"/);
  assert.match(source, /"unlink_parent_student"/);
});

test("admin users route supports normalized teacher specialization and class assignment payloads", async () => {
  const source = await readUsersApiSurface();

  assert.match(source, /specializationSubjectIds/);
  assert.match(source, /teachingAssignments/);
  assert.match(source, /supervisedClassIds/);
  assert.match(source, /teacher_subject_specializations/);
  assert.match(source, /teacher_class_subject_assignments/);
});

test("admin users page exposes structured teacher assignment controls", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /Subject specializations/);
  assert.match(source, /Teaching assignments/);
  assert.match(source, /Class teacher responsibilities/);
});

test("admin users page lets admins add missing subjects and classes inline", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /Add subject/);
  assert.match(source, /Add class/);
  assert.match(source, /createSubjectInline/);
  assert.match(source, /createClassInline/);
  assert.match(source, /openCreateSubjectInlineSection/);
  assert.match(source, /openCreateClassInlineSection/);
});

test("admin users page no longer exposes an editable specialization summary field", async () => {
  const source = await readUsersUiSurface();

  assert.doesNotMatch(source, /label="Specialization summary"/);
});

test("admin users page surfaces duplicate teacher validation and clear primary actions", async () => {
  const source = await readUsersUiSurface();

  assert.match(source, /already linked to another user/);
  assert.match(source, /already assigned to another teacher/);
  assert.match(source, /Create \$\{activeTab === "students"/);
});

test("admin users route builds teacher detail from normalized assignment tables", async () => {
  const routeSource = await readUsersApiSurface();
  const teacherDetailSource = await readFile(teacherDetailPath, "utf8");
  const builderSource = await readFile(teacherDetailBuilderPath, "utf8");

  assert.match(routeSource, /loadTeacherAccountDetail/);
  assert.match(teacherDetailSource, /loadTeacherSpecializationRows/);
  assert.match(teacherDetailSource, /loadTeacherClassSubjectAssignments/);
  assert.match(builderSource, /specializationSubjectIds/);
  assert.match(builderSource, /supervisedClassIds/);
});
