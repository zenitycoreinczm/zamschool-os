import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Gate 4 / plan s4, s6, s18, s21 "Results", s39 (broken authorization and
// incorrect student results are P0).
//
// The approval chain is: teacher enters marks -> academic office verifies ->
// head teacher releases -> pupil and parent see the final result. Mobile's edge
// enforces that: `canApproveFinalResults` gates every write of
// grading_status='published', and the head teacher's authority is not
// bypassable from the phone.
//
// Web used to disagree. `/api/teacher/results-publish` is reachable by role
// TEACHER alone (requireTeacherContext -> allowedRoles: ["TEACHER"]) yet it wrote
// grading_status:'published' with published_at set, and fanned push alerts out
// to parents on the spot. Any teacher could put unverified marks in front of a
// family, and one account on two clients got two different answers about who
// owns the final result.
//
// The fix is directional, not symmetric: the teacher endpoint now hands marks
// over, and the release fan-out moved to the approval desk. Both halves are
// pinned here, because a change that only moves the gate and forgets the
// notification would silently stop parents hearing about results at all.

const teacherPublish = readFileSync(
  "app/api/teacher/results-publish/route.ts",
  "utf8",
);
const adminResults = readFileSync("app/api/admin/results/route.ts", "utf8");

test("teacher release endpoint no longer claims the final release", () => {
  assert.doesNotMatch(
    teacherPublish,
    /grading_status:\s*"published"/,
    "a teacher must not be able to write the released state from web",
  );
  assert.match(
    teacherPublish,
    /grading_status:\s*"submitted"/,
    "the teacher write must land the marks in the approval queue",
  );
  assert.match(teacherPublish, /submitted_by:\s*userId/);
  assert.doesNotMatch(
    teacherPublish,
    /syncResultPublishNotifications/,
    "handing marks over is not a release, so no parent alert belongs here",
  );
  assert.match(teacherPublish, /action:\s*"results\.submitted"/);
});

test("teacher endpoint answers with what actually happened", () => {
  // plan s22: never tell a user something succeeded that did not.
  assert.doesNotMatch(teacherPublish, /`Published \$\{/);
  assert.match(
    teacherPublish,
    /Sent \$\{toSubmit\.length\} results for approval/,
    "the success text must say the marks went for approval",
  );
});

test("an already released result is never withdrawn by a re-submit", () => {
  // The old code re-published already-published rows on every call. The same
  // mistake in reverse (writing 'submitted' over a released row) would pull
  // results back out from under parents who can already see them.
  assert.match(teacherPublish, /const isReleased = \(row: any\) =>/);
  assert.match(
    teacherPublish,
    /\["published", "approved"\]\.includes\(/,
    "published and approved rows are both past the point of a teacher edit",
  );
  assert.match(
    teacherPublish,
    /scopedResults\.filter\(\(row: any\) => !isReleased\(row\)\)/,
  );
  assert.doesNotMatch(
    teacherPublish,
    /toPublish\.length > 0 \? toPublish : scopedResults/,
    "falling back to the full set would overwrite released rows",
  );
});

test("only the approval desk releases, and it alerts the parents it releases to", () => {
  assert.match(
    adminResults,
    /targetStatus === "published" && schoolId/,
    "the release side-effects stay tied to the published transition",
  );
  assert.match(adminResults, /syncResultPublishNotifications\(\{/);
  assert.match(
    adminResults,
    /parentsNotified:\s*releaseDelivery\.parentCount/,
    "a release records who was told (plan s17 WHO/WHAT/WHEN, s27 delivery)",
  );
  // The fan-out needs the pupil and the assignment; a select of
  // `id, grading_status` would notify nobody and say so with a zero.
  assert.match(adminResults, /"id, grading_status, student_id, assignment_id,/);
  assert.match(adminResults, /assignments\(id, title, class_id, subject_id, teacher_id\)/);
});

test("release still requires a moderation role and a legal transition", () => {
  assert.match(
    adminResults,
    /authorizeWorkflowTransition\(\s*"grading",\s*currentStatus,\s*newStatus,\s*access\.context\.role,?\s*\)/,
    "the server, not the client, decides whether this caller may publish",
  );
  assert.match(adminResults, /RESULTS_MODERATION_ROLES/);
});
