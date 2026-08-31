import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInitialRollCallState,
  mergeRollCallStateOnRefresh,
} from "../../lib/attendance/rollcall-state.ts";

function lesson(overrides = {}) {
  return {
    id: "lesson-1",
    roster: [],
    window: { canMark: true },
    ...overrides,
  };
}

function student(id, status) {
  return { id, status };
}

test("initial load seeds exceptions from non-present roster statuses", () => {
  const lessons = [
    lesson({
      id: "l1",
      roster: [
        student("s1", "PRESENT"),
        student("s2", "ABSENT"),
        student("s3", null),
        student("s4", "LATE"),
      ],
    }),
  ];

  const { exceptions } = buildInitialRollCallState(lessons);

  assert.deepEqual(exceptions.l1, { s2: "ABSENT", s4: "LATE" });
});

test("initial load expands lessons that can be marked", () => {
  const lessons = [
    lesson({ id: "open", window: { canMark: true } }),
    lesson({ id: "locked", window: { canMark: false } }),
    lesson({ id: "no-window", window: undefined }),
  ];

  const { expanded } = buildInitialRollCallState(lessons);

  assert.ok(expanded.has("open"));
  assert.ok(!expanded.has("locked"));
  assert.ok(expanded.has("no-window"));
});

test("refresh preserves staged (unsaved) exceptions for known lessons", () => {
  const prevExceptions = { l1: { s2: "EXCUSED" } };
  const prevExpanded = new Set(["l1"]);
  const lessons = [
    lesson({
      id: "l1",
      roster: [student("s1", "PRESENT"), student("s2", "ABSENT")],
    }),
  ];

  const { exceptions } = mergeRollCallStateOnRefresh(
    prevExceptions,
    prevExpanded,
    lessons,
  );

  assert.deepEqual(
    exceptions.l1,
    { s2: "EXCUSED" },
    "teacher's unsaved edits must survive a background refresh",
  );
});

test("refresh seeds exceptions for newly appearing lessons", () => {
  const { exceptions } = mergeRollCallStateOnRefresh({}, new Set(), [
    lesson({
      id: "l2",
      roster: [student("s5", "LATE")],
    }),
  ]);

  assert.deepEqual(exceptions.l2, { s5: "LATE" });
});

test("refresh keeps previously collapsed lessons collapsed", () => {
  // After the initial load every known lesson id exists in exceptions,
  // so a collapsed lesson is "known but not in prevExpanded".
  const prevExceptions = { l1: {} };
  const prevExpanded = new Set();
  const lessons = [lesson({ id: "l1", window: { canMark: true } })];

  const { expanded } = mergeRollCallStateOnRefresh(
    prevExceptions,
    prevExpanded,
    lessons,
  );

  assert.ok(
    !expanded.has("l1"),
    "a lesson the teacher collapsed must not pop open again on refresh",
  );
});

test("refresh drops state for lessons that disappeared", () => {
  const prevExceptions = { gone: { s1: "ABSENT" } };
  const prevExpanded = new Set(["gone"]);

  const { exceptions, expanded } = mergeRollCallStateOnRefresh(
    prevExceptions,
    prevExpanded,
    [lesson({ id: "l1" })],
  );

  assert.equal(exceptions.gone, undefined);
  assert.ok(!expanded.has("gone"));
});
