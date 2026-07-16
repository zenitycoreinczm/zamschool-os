import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// ─── Roll call regression tests ────────────────────────────────────────────
//
// Verifies the onConflict target, session name consistency, session_time
// NULL handling, parallelized queries, and deferred notifications.

const attendanceSource = readFileSync(
  "app/api/teacher/attendance/route.ts",
  "utf8",
);
const classesSource = readFileSync("app/api/teacher/classes/route.ts", "utf8");

test("onConflict target matches attendance_roll_call_unique (no session_time)", () => {
  assert.match(
    attendanceSource,
    /onConflict:\s*["']school_id,class_id,student_id,attendance_date,session_name["']/,
    "onConflict must not include session_time - it doesn't match any unique constraint",
  );
  assert.doesNotMatch(
    attendanceSource,
    /onConflict:\s*["']school_id,class_id,student_id,attendance_date,session_name,session_time["']/,
    "old onConflict with session_time must be gone - it causes a DB error",
  );
});

test("loadExistingAttendance does not filter by session_time", () => {
  const fnMatch = attendanceSource.match(
    /async function loadExistingAttendance[\s\S]*?\n}/,
  );
  assert.ok(fnMatch, "loadExistingAttendance must exist");
  assert.doesNotMatch(
    fnMatch[0],
    /\.eq\(\s*["']session_time["']/,
    "loadExistingAttendance must not filter by session_time - NULL ≠ '' breaks the query",
  );
});

test("POST route fetches class, roster, and existing attendance in parallel", () => {
  // After the lesson fetch, the route should Promise.all the three queries
  const postMatch = attendanceSource.match(
    /export async function POST[\s\S]*?const \[classRow, rosterRows, existingAttendance\] = await Promise\.all/,
  );
  assert.ok(
    postMatch,
    "POST must parallelize class, roster, and existing-attendance fetches",
  );
});

test("POST route defers notifications (non-blocking)", () => {
  assert.match(
    attendanceSource,
    /\.catch\(\(err\)\s*=>\s*\{[\s\S]*?notification fan-out failed/,
    "notifications must have a .catch() so they don't block the response",
  );
});

test("write path session name includes session type prefix", () => {
  assert.match(
    attendanceSource,
    /sessionName\s*=\s*`\$\{sessionType\} - \$\{baseSessionName\}`/,
    "write path must use `${sessionType} - ${baseSessionName}` format",
  );
});

test("read path (classes route) session name includes session type prefix", () => {
  const match = classesSource.match(
    /const baseSessionName\s*=\s*lesson\.title[^\n]*\r?\n[^\n]*const sessionType\s*=\s*detectSessionType[\s\S]*?const sessionName\s*=\s*`\$\{sessionType\} - \$\{baseSessionName\}`/,
  );
  assert.ok(
    match,
    "read path must use the same `${sessionType} - ${baseSessionName}` format as the write path",
  );
});

test("read path has detectSessionType helper", () => {
  assert.match(
    classesSource,
    /function detectSessionType/,
    "classes route must define detectSessionType to match the write path",
  );
});

test("SICK status is not in the Zod schema (DB doesn't support it)", () => {
  assert.doesNotMatch(
    attendanceSource,
    /attendanceStatusSchema[\s\S]*?"SICK"/,
    "SICK must not be in the Zod schema - the DB CHECK constraint only allows present/absent/late/excused",
  );
});

test("Evening is available in SESSION_TYPES on the frontend", () => {
  const pageSource = readFileSync(
    "app/app/teacher/attendance/page.tsx",
    "utf8",
  );
  assert.match(
    pageSource,
    /["']Evening["']/,
    "Evening must be in SESSION_TYPES - it was missing, causing evening lessons to have no matching dropdown option",
  );
});

test("frontend refreshes roster after successful save", () => {
  const pageSource = readFileSync(
    "app/app/teacher/attendance/page.tsx",
    "utf8",
  );
  assert.match(
    pageSource,
    /await loadLessons\(date\)/,
    "frontend must call loadLessons after successful save to reflect saved statuses",
  );
});
