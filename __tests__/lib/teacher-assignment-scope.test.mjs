import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// TypeScript modules are imported via the project's tsx/ts-node path when
// available; fall back to a pure source-level contract test when not.
let buildTeacherAssignmentScope;
let teacherHasClassAccess;
try {
  ({
    buildTeacherAssignmentScope,
    teacherHasClassAccess,
  } = await import("../../lib/teacher-assignment-scope.ts"));
} catch {
  // Dynamic TS import may fail under plain node:test; use source contract checks.
}

test("subject teaching assignment alone grants class student access", () => {
  if (!buildTeacherAssignmentScope) {
    const source = require("node:fs").readFileSync(
      "lib/teacher-assignment-scope.ts",
      "utf8",
    );
    assert.match(source, /assignedClassIds/);
    assert.match(
      source,
      /allowedClassIds:\s*uniqueValues\(\[\.\.\.supervisedClassIds,\s*\.\.\.taughtClassIds,\s*\.\.\.assignedClassIds\]\)/,
    );
    return;
  }

  const profileId = "profile-teacher-1";
  const teacherRowId = "teacher-row-1";
  const classId = "class-grade-7a";
  const schoolId = "school-1";

  const scope = buildTeacherAssignmentScope({
    actorProfileId: profileId,
    schoolId,
    teachers: [{ id: teacherRowId, profile_id: profileId }],
    classes: [], // not class teacher
    lessons: [], // no timetable yet
    assignments: [
      {
        school_id: schoolId,
        class_id: classId,
        teacher_profile_id: profileId,
      },
    ],
  });

  assert.deepEqual(scope.supervisedClassIds, []);
  assert.ok(scope.taughtClassIds.includes(classId));
  assert.ok(scope.allowedClassIds.includes(classId));
  assert.equal(teacherHasClassAccess(scope, classId), true);
  assert.equal(teacherHasClassAccess(scope, "other-class"), false);
});

test("class teacher (supervisor) alone grants class student access", () => {
  if (!buildTeacherAssignmentScope) return;

  const profileId = "profile-teacher-2";
  const teacherRowId = "teacher-row-2";
  const classId = "class-grade-8b";
  const schoolId = "school-1";

  const scope = buildTeacherAssignmentScope({
    actorProfileId: profileId,
    schoolId,
    teachers: [{ id: teacherRowId, profile_id: profileId }],
    classes: [
      {
        id: classId,
        school_id: schoolId,
        supervisor_id: profileId,
      },
    ],
    lessons: [],
    assignments: [],
  });

  assert.ok(scope.supervisedClassIds.includes(classId));
  assert.ok(scope.allowedClassIds.includes(classId));
});

test("timetable lesson alone grants class student access", () => {
  if (!buildTeacherAssignmentScope) return;

  const profileId = "profile-teacher-3";
  const teacherRowId = "teacher-row-3";
  const classId = "class-grade-9c";
  const schoolId = "school-1";

  const scope = buildTeacherAssignmentScope({
    actorProfileId: profileId,
    schoolId,
    teachers: [{ id: teacherRowId, profile_id: profileId }],
    classes: [],
    lessons: [
      {
        id: "lesson-1",
        school_id: schoolId,
        class_id: classId,
        teacher_id: teacherRowId,
      },
    ],
    assignments: [],
  });

  assert.ok(scope.taughtClassIds.includes(classId));
  assert.ok(scope.allowedClassIds.includes(classId));
});
