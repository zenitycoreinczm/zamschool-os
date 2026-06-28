import test from "node:test";
import assert from "node:assert/strict";

import {
  detectAttendanceConflict,
  generateConflictMetadata,
} from "../../lib/attendance/conflict.ts";

const NOW = Date.now();
const FIVE_MIN = 5 * 60 * 1000;

// ─── detectAttendanceConflict ─────────────────────────────────────────────

test("detectAttendanceConflict returns no conflict when no existing record", () => {
  const result = detectAttendanceConflict(null, "PRESENT", "user-1");
  assert.equal(result.hasConflict, false);
  assert.equal(result.conflictType, null);
  assert.equal(result.resolution, "last-write-wins");
});

test("detectAttendanceConflict returns no conflict when same user updates", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - 1000).toISOString(), recorded_by: "user-1", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.hasConflict, false);
  assert.equal(result.resolution, "last-write-wins");
});

test("detectAttendanceConflict returns no conflict when status is the same (case-insensitive)", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - 1000).toISOString(), recorded_by: "user-2", status: "PRESENT" },
    "present",
    "user-1",
  );
  assert.equal(result.hasConflict, false);
});

test("detectAttendanceConflict detects concurrent-edit within 5 minutes", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - 60_000).toISOString(), recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictType, "concurrent-edit");
  assert.equal(result.resolution, "last-write-wins");
  assert.equal(result.existingData?.recordedBy, "user-2");
  assert.equal(result.existingData?.status, "ABSENT");
});

test("detectAttendanceConflict detects data-overwrite for records older than 5 minutes", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - 10 * 60_000).toISOString(), recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictType, "data-overwrite");
});

test("detectAttendanceConflict uses 5-minute boundary: 4:59 is concurrent", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - (FIVE_MIN - 1000)).toISOString(), recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.conflictType, "concurrent-edit");
});

test("detectAttendanceConflict uses 5-minute boundary: 5:01 is data-overwrite", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - (FIVE_MIN + 1000)).toISOString(), recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.conflictType, "data-overwrite");
});

test("detectAttendanceConflict handles null created_at gracefully (treats as epoch → data-overwrite)", () => {
  const result = detectAttendanceConflict(
    { created_at: null, recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.hasConflict, true);
  assert.equal(result.conflictType, "data-overwrite");
});

test("detectAttendanceConflict handles null recorded_by", () => {
  const result = detectAttendanceConflict(
    { created_at: new Date(NOW - 1000).toISOString(), recorded_by: null, status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  assert.equal(result.hasConflict, true);
  assert.equal(result.existingData?.recordedBy, "");
});

// ─── generateConflictMetadata ─────────────────────────────────────────────

test("generateConflictMetadata returns empty object when no conflict", () => {
  const info = detectAttendanceConflict(null, "PRESENT", "user-1");
  const meta = generateConflictMetadata(info, "lesson-1", "student-1");
  assert.deepEqual(meta, {});
});

test("generateConflictMetadata includes all fields when conflict exists", () => {
  const info = detectAttendanceConflict(
    { created_at: new Date(NOW - 1000).toISOString(), recorded_by: "user-2", status: "ABSENT" },
    "PRESENT",
    "user-1",
  );
  const meta = generateConflictMetadata(info, "lesson-1", "student-1");
  assert.equal(meta.conflict_detected, true);
  assert.equal(meta.conflict_type, "concurrent-edit");
  assert.equal(meta.conflict_resolution, "last-write-wins");
  assert.equal(meta.lesson_id, "lesson-1");
  assert.equal(meta.student_id, "student-1");
  assert.equal(meta.previous_recorded_by, "user-2");
  assert.equal(meta.previous_status, "ABSENT");
  assert.ok(meta.conflict_timestamp);
});
