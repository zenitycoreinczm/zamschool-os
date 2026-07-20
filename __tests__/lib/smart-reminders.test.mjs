import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CLASS_PREP_REMINDER_MINUTES,
  SCHOOL_LATE_REMINDER_OFFSETS_MIN,
  classPrepReminderCopy,
  schoolLateReminderCopy,
} from "../../lib/smart-reminders.ts";
import {
  DEFAULT_MORNING_REMINDER_OFFSETS,
  buildMorningReminderSlots,
  normalizeSchoolDayHours,
} from "../../lib/school-day-hours.ts";

describe("smart reminders policy", () => {
  it("defaults to 90 then 60 minutes before class start", () => {
    assert.deepEqual([...SCHOOL_LATE_REMINDER_OFFSETS_MIN], [90, 60]);
    assert.deepEqual([...DEFAULT_MORNING_REMINDER_OFFSETS], [90, 60]);
    assert.equal(CLASS_PREP_REMINDER_MINUTES, 5);
  });

  it("builds morning slots with don't-be-late copy", () => {
    const hours = normalizeSchoolDayHours({
      classesStartAt: "08:00",
      morningReminderOffsetsMinutes: [90, 60],
    });
    const slots = buildMorningReminderSlots(hours);
    assert.equal(slots.length, 2);
    assert.equal(slots[0].offsetMinutes, 90);
    assert.equal(slots[0].fireAt, "06:30");
    assert.equal(slots[1].offsetMinutes, 60);
    assert.equal(slots[1].fireAt, "07:00");
    assert.match(slots[0].title, /late|ready|school/i);
    assert.match(slots[1].title, /leave|late|class/i);
  });

  it("teacher class prep is 5 minutes", () => {
    const copy = classPrepReminderCopy({
      audience: "teacher",
      subjectName: "Math",
      className: "Form 1",
      startTime: "09:00",
      minutesBefore: 5,
    });
    assert.match(copy.title, /5 min|Teach/i);
    assert.match(copy.body, /Attendance|Prepare/i);
  });

  it("student class prep urges not late", () => {
    const copy = classPrepReminderCopy({
      audience: "student",
      subjectName: "English",
      minutesBefore: 5,
    });
    assert.match(copy.title, /late|English/i);
  });

  it("parent morning copy mentions children", () => {
    const copy = schoolLateReminderCopy({
      classesStartAt: "08:00",
      offsetMinutes: 90,
      audience: "parent",
    });
    assert.match(copy.title, /children|ready/i);
  });
});
