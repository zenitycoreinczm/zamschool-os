import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateRollCallWindow,
  parseTimeToMinutes,
  shouldAlertHeadTeacherForLateRollCall,
} from "../../lib/attendance/window.ts";

test("parseTimeToMinutes handles HH:MM and HH:MM:SS", () => {
  assert.equal(parseTimeToMinutes("13:20"), 13 * 60 + 20);
  assert.equal(parseTimeToMinutes("08:00:00"), 8 * 60);
  assert.equal(parseTimeToMinutes(""), null);
});

test("evaluateRollCallWindow blocks before start", () => {
  // 13:00 school time — class at 13:20
  const now = new Date("2026-07-17T11:00:00.000Z"); // 13:00 Africa/Lusaka
  const win = evaluateRollCallWindow({
    lessonDate: "2026-07-17",
    startTime: "13:20",
    endTime: "14:00",
    now,
    timeZone: "Africa/Lusaka",
  });
  assert.equal(win.status, "upcoming");
  assert.equal(win.canMark, false);
});

test("evaluateRollCallWindow is open during period", () => {
  const now = new Date("2026-07-17T11:25:00.000Z"); // 13:25 Lusaka
  const win = evaluateRollCallWindow({
    lessonDate: "2026-07-17",
    startTime: "13:20",
    endTime: "14:00",
    now,
    timeZone: "Africa/Lusaka",
  });
  assert.equal(win.status, "open");
  assert.equal(win.canMark, true);
});

test("evaluateRollCallWindow is late after 10 minutes", () => {
  const now = new Date("2026-07-17T11:35:00.000Z"); // 13:35 Lusaka = 15 min late
  const win = evaluateRollCallWindow({
    lessonDate: "2026-07-17",
    startTime: "13:20",
    endTime: "14:00",
    now,
    timeZone: "Africa/Lusaka",
    hasSubmission: false,
  });
  assert.equal(win.status, "late");
  assert.equal(win.canMark, true);
  assert.equal(win.isLate, true);
  assert.ok((win.minutesLate || 0) >= 10);
  assert.equal(
    shouldAlertHeadTeacherForLateRollCall({ window: win, hasSubmission: false }),
    true,
  );
});

test("evaluateRollCallWindow closes after end", () => {
  const now = new Date("2026-07-17T12:10:00.000Z"); // 14:10 Lusaka
  const win = evaluateRollCallWindow({
    lessonDate: "2026-07-17",
    startTime: "13:20",
    endTime: "14:00",
    now,
    timeZone: "Africa/Lusaka",
  });
  assert.equal(win.status, "closed");
  assert.equal(win.canMark, false);
});

test("evaluateRollCallWindow blocks wrong day", () => {
  const now = new Date("2026-07-17T11:25:00.000Z");
  const win = evaluateRollCallWindow({
    lessonDate: "2026-07-18",
    startTime: "13:20",
    endTime: "14:00",
    now,
    timeZone: "Africa/Lusaka",
  });
  assert.equal(win.status, "wrong_day");
  assert.equal(win.canMark, false);
});
