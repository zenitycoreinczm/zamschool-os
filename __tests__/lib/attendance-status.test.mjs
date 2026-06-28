import test from "node:test";
import assert from "node:assert/strict";

import {
  ATTENDANCE_STATUSES,
  isAttendanceStatus,
  formatAttendanceStatusLabel,
  formatLessonClockTime,
  formatAttendanceSessionDate,
} from "../../lib/attendance/status.ts";

// ─── isAttendanceStatus ──────────────────────────────────────────────────

test("isAttendanceStatus returns true for all defined statuses (case-insensitive)", () => {
  for (const status of ATTENDANCE_STATUSES) {
    assert.equal(isAttendanceStatus(status), true);
    assert.equal(isAttendanceStatus(status.toLowerCase()), true);
  }
});

test("isAttendanceStatus returns false for null/undefined/empty", () => {
  assert.equal(isAttendanceStatus(null), false);
  assert.equal(isAttendanceStatus(undefined), false);
  assert.equal(isAttendanceStatus(""), false);
  assert.equal(isAttendanceStatus("   "), false);
});

test("isAttendanceStatus returns false for unknown statuses", () => {
  assert.equal(isAttendanceStatus("UNKNOWN"), false);
  assert.equal(isAttendanceStatus("PRESENTT"), false);
});

// ─── formatAttendanceStatusLabel ─────────────────────────────────────────

test("formatAttendanceStatusLabel returns lowercase label for known statuses", () => {
  assert.equal(formatAttendanceStatusLabel("PRESENT"), "present");
  assert.equal(formatAttendanceStatusLabel("ABSENT"), "absent");
  assert.equal(formatAttendanceStatusLabel("LATE"), "late");
  assert.equal(formatAttendanceStatusLabel("EXCUSED"), "excused");
  assert.equal(formatAttendanceStatusLabel("SICK"), "sick");
});

test("formatAttendanceStatusLabel is case-insensitive", () => {
  assert.equal(formatAttendanceStatusLabel("Present"), "present");
  assert.equal(formatAttendanceStatusLabel("absent"), "absent");
});

test("formatAttendanceStatusLabel returns 'unmarked' for null/undefined/empty", () => {
  assert.equal(formatAttendanceStatusLabel(null), "unmarked");
  assert.equal(formatAttendanceStatusLabel(undefined), "unmarked");
  assert.equal(formatAttendanceStatusLabel(""), "unmarked");
});

test("formatAttendanceStatusLabel returns lowercased unknown status", () => {
  assert.equal(formatAttendanceStatusLabel("PENDING"), "pending");
});

// ─── formatLessonClockTime ────────────────────────────────────────────────

test("formatLessonClockTime converts 24h to 12h AM", () => {
  assert.equal(formatLessonClockTime("08:30"), "8:30 AM");
  assert.equal(formatLessonClockTime("00:00"), "12:00 AM");
  assert.equal(formatLessonClockTime("11:59"), "11:59 AM");
});

test("formatLessonClockTime converts 24h to 12h PM", () => {
  assert.equal(formatLessonClockTime("12:00"), "12:00 PM");
  assert.equal(formatLessonClockTime("13:30"), "1:30 PM");
  assert.equal(formatLessonClockTime("23:59"), "11:59 PM");
});

test("formatLessonClockTime handles seconds gracefully", () => {
  assert.equal(formatLessonClockTime("08:30:45"), "8:30 AM");
  assert.equal(formatLessonClockTime("14:00:00"), "2:00 PM");
});

test("formatLessonClockTime returns empty string for empty/null input", () => {
  assert.equal(formatLessonClockTime(""), "");
  assert.equal(formatLessonClockTime(null), "");
  assert.equal(formatLessonClockTime(undefined), "");
});

test("formatLessonClockTime returns raw input (truncated to 5 chars) for malformed time", () => {
  // When parts.length < 2, returns raw input; when hour is NaN, returns raw.slice(0,5)
  assert.equal(formatLessonClockTime("noon"), "noon");
  assert.equal(formatLessonClockTime("abc:def"), "abc:d");
});

// ─── formatAttendanceSessionDate ──────────────────────────────────────────

test("formatAttendanceSessionDate formats valid ISO date", () => {
  const result = formatAttendanceSessionDate("2026-03-15");
  // Exact weekday depends on TZ, but should contain day, month abbreviation, year
  assert.match(result, /15/);
  assert.match(result, /Mar/);
  assert.match(result, /2026/);
});

test("formatAttendanceSessionDate returns input unchanged for non-ISO format", () => {
  assert.equal(formatAttendanceSessionDate("March 15, 2026"), "March 15, 2026");
  assert.equal(formatAttendanceSessionDate("2026/03/15"), "2026/03/15");
});
