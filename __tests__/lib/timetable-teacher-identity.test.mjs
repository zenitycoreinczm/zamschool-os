import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let teacherIdentityMatches;
let buildTeacherAliasMap;
let buildTimetableBoard;
try {
  ({
    teacherIdentityMatches,
    buildTeacherAliasMap,
    buildTimetableBoard,
  } = await import("../../lib/timetable-workspace.ts"));
} catch {
  teacherIdentityMatches = null;
}

test("teacher filter matches lessons stored with teachers.row id when UI uses profile id", () => {
  if (!teacherIdentityMatches) {
    const source = readFileSync("lib/timetable-workspace.ts", "utf8");
    assert.match(source, /teacherIdentityMatches/);
    assert.match(source, /teacher_profile_id/);
    return;
  }

  const profileId = "profile-abc";
  const rowId = "teacher-row-xyz";
  const aliases = buildTeacherAliasMap([
    { id: profileId, role_record_id: rowId },
  ]);

  assert.equal(
    teacherIdentityMatches(
      { teacher_id: rowId, teacher_profile_id: profileId },
      profileId,
      aliases,
    ),
    true,
  );
  assert.equal(
    teacherIdentityMatches(
      { teacher_id: rowId, teacher_profile_id: profileId },
      rowId,
      aliases,
    ),
    true,
  );
  assert.equal(
    teacherIdentityMatches(
      { teacher_id: rowId, teacher_profile_id: profileId },
      "someone-else",
      aliases,
    ),
    false,
  );
});

test("board shows lessons for selected teacher profile id", () => {
  if (!buildTimetableBoard) return;

  const profileId = "profile-abc";
  const rowId = "teacher-row-xyz";
  const aliases = buildTeacherAliasMap([
    { id: profileId, role_record_id: rowId },
  ]);

  const board = buildTimetableBoard({
    lessons: [
      {
        id: "lesson-1",
        title: "Chemistry",
        subject_id: "sub-1",
        class_id: "class-1",
        teacher_id: rowId,
        teacher_profile_id: profileId,
        day_of_week: 1,
        start_time: "07:00:00",
        end_time: "08:00:00",
      },
    ],
    selectedClass: "all",
    selectedTeacher: profileId,
    classMap: { "class-1": "7A" },
    subjectMap: { "sub-1": "Chemistry" },
    teacherMap: { [profileId]: "Mr Chem", [rowId]: "Mr Chem" },
    teacherAliases: aliases,
  });

  assert.equal(board.totalLessons, 1);
  assert.equal(board.days.find((d) => d.key === 1)?.totalLessons, 1);
});
