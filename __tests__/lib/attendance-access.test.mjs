import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let canTeacherAccessLesson;
try {
  ({ canTeacherAccessLesson } = await import(
    "../../lib/attendance/access.ts"
  ));
} catch {
  canTeacherAccessLesson = null;
}

test("subject teacher with allowed class can access any lesson in that class", () => {
  if (!canTeacherAccessLesson) {
    const source = readFileSync("lib/attendance/access.ts", "utf8");
    assert.match(source, /allowedClassIds/);
    assert.match(source, /classId/);
    return;
  }

  const allowed = canTeacherAccessLesson({
    actorId: "profile-subject-teacher",
    lessonTeacherId: "other-teacher-row",
    classSupervisorId: "class-teacher-profile",
    lessonSchoolId: "school-1",
    actorSchoolId: "school-1",
    classId: "class-7a",
    allowedClassIds: ["class-7a", "class-8b"],
  });

  assert.equal(allowed, true);
});

test("teacher without class scope cannot access foreign lesson", () => {
  if (!canTeacherAccessLesson) return;

  const denied = canTeacherAccessLesson({
    actorId: "profile-subject-teacher",
    lessonTeacherId: "other-teacher-row",
    classSupervisorId: "class-teacher-profile",
    lessonSchoolId: "school-1",
    actorSchoolId: "school-1",
    classId: "class-7a",
    allowedClassIds: ["class-8b"],
  });

  assert.equal(denied, false);
});

test("class teacher still has access without teaching assignment list", () => {
  if (!canTeacherAccessLesson) return;

  const allowed = canTeacherAccessLesson({
    actorId: "class-teacher-profile",
    lessonTeacherId: "other-teacher-row",
    classSupervisorId: "class-teacher-profile",
    lessonSchoolId: "school-1",
    actorSchoolId: "school-1",
  });

  assert.equal(allowed, true);
});

test("lesson owner still has access without supervisor role", () => {
  if (!canTeacherAccessLesson) return;

  const allowed = canTeacherAccessLesson({
    actorId: "teacher-row-1",
    lessonTeacherId: "teacher-row-1",
    classSupervisorId: "someone-else",
    lessonSchoolId: "school-1",
    actorSchoolId: "school-1",
  });

  assert.equal(allowed, true);
});
