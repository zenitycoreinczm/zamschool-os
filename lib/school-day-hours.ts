/**
 * School day schedule (shared web + mobile).
 *
 * Head Teacher sets when campus opens and when classes start/end.
 * Academic Admin uses the class window for timetables.
 * Mobile schedules morning “get ready / don’t be late” local reminders
 * before classesStartAt.
 */

export const SCHOOL_DAY_SETTING_KEY = "school_day";

export const DEFAULT_SCHOOL_TIMEZONE =
  process.env.SCHOOL_TIMEZONE || "Africa/Lusaka";

/**
 * Minutes before classesStartAt for “don’t be late” morning nudges.
 * Product default: 1h30 before school, then again 30 minutes after that (1h before).
 * Schools can still override via school_day settings.
 */
export const DEFAULT_MORNING_REMINDER_OFFSETS = [90, 60] as const;

export type SchoolDayHours = {
  timezone: string;
  /** Campus / gates open (may be before first lesson). */
  schoolOpensAt: string;
  /** First lesson window starts (timetable lower bound). */
  classesStartAt: string;
  /** Last lesson window ends (timetable upper bound). */
  classesEndAt: string;
  /** Campus closes (may be after last lesson). */
  schoolClosesAt: string;
  /**
   * Offsets in minutes before classesStartAt for student wake-up / on-time nudges.
   * Example with start 08:00 and [120,90,60,30] → 06:00, 06:30, 07:00, 07:30.
   */
  morningReminderOffsetsMinutes: number[];
};

export type MorningReminderSlot = {
  offsetMinutes: number;
  fireAt: string;
  minutesUntilClassStart: number;
  label: string;
  title: string;
  body: string;
};

export const DEFAULT_SCHOOL_DAY_HOURS: SchoolDayHours = {
  timezone: DEFAULT_SCHOOL_TIMEZONE,
  schoolOpensAt: "07:00",
  classesStartAt: "08:00",
  classesEndAt: "16:00",
  schoolClosesAt: "16:30",
  morningReminderOffsetsMinutes: [...DEFAULT_MORNING_REMINDER_OFFSETS],
};

/** Parse "HH:MM" / "HH:MM:SS" → minutes from midnight. */
export function parseClockToMinutes(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function formatMinutesAsClock(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Normalize any input to HH:MM or null. */
export function normalizeClock(value: string | null | undefined): string | null {
  const mins = parseClockToMinutes(value);
  return mins == null ? null : formatMinutesAsClock(mins);
}

function cleanOffsets(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_MORNING_REMINDER_OFFSETS];
  }
  const nums = raw
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 12 * 60)
    .map((n) => Math.round(n));
  const unique = Array.from(new Set(nums)).sort((a, b) => b - a);
  return unique.length > 0 ? unique : [...DEFAULT_MORNING_REMINDER_OFFSETS];
}

/**
 * Accepts DB jsonb / API body (camel or snake_case) and returns a safe schedule.
 */
export function normalizeSchoolDayHours(raw: unknown): SchoolDayHours {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const timezone =
    String(src.timezone || src.time_zone || DEFAULT_SCHOOL_TIMEZONE).trim() ||
    DEFAULT_SCHOOL_TIMEZONE;

  const schoolOpensAt =
    normalizeClock(
      (src.schoolOpensAt ??
        src.school_opens_at ??
        src.opensAt ??
        src.opens_at ??
        DEFAULT_SCHOOL_DAY_HOURS.schoolOpensAt) as string,
    ) || DEFAULT_SCHOOL_DAY_HOURS.schoolOpensAt;

  const classesStartAt =
    normalizeClock(
      (src.classesStartAt ??
        src.classes_start_at ??
        src.classStartAt ??
        src.class_start_at ??
        DEFAULT_SCHOOL_DAY_HOURS.classesStartAt) as string,
    ) || DEFAULT_SCHOOL_DAY_HOURS.classesStartAt;

  const classesEndAt =
    normalizeClock(
      (src.classesEndAt ??
        src.classes_end_at ??
        src.classEndAt ??
        src.class_end_at ??
        DEFAULT_SCHOOL_DAY_HOURS.classesEndAt) as string,
    ) || DEFAULT_SCHOOL_DAY_HOURS.classesEndAt;

  const schoolClosesAt =
    normalizeClock(
      (src.schoolClosesAt ??
        src.school_closes_at ??
        src.closesAt ??
        src.closes_at ??
        DEFAULT_SCHOOL_DAY_HOURS.schoolClosesAt) as string,
    ) || DEFAULT_SCHOOL_DAY_HOURS.schoolClosesAt;

  const morningReminderOffsetsMinutes = cleanOffsets(
    src.morningReminderOffsetsMinutes ??
      src.morning_reminder_offsets_minutes ??
      src.morningReminders ??
      src.reminder_offsets,
  );

  return {
    timezone,
    schoolOpensAt,
    classesStartAt,
    classesEndAt,
    schoolClosesAt,
    morningReminderOffsetsMinutes,
  };
}

/**
 * Validate logical order. Returns error message or null if OK.
 * Order expected:
 *   schoolOpensAt ≤ classesStartAt < classesEndAt ≤ schoolClosesAt
 */
export function validateSchoolDayHours(hours: SchoolDayHours): string | null {
  const opens = parseClockToMinutes(hours.schoolOpensAt);
  const start = parseClockToMinutes(hours.classesStartAt);
  const end = parseClockToMinutes(hours.classesEndAt);
  const closes = parseClockToMinutes(hours.schoolClosesAt);

  if (opens == null || start == null || end == null || closes == null) {
    return "All times must be valid HH:MM values.";
  }
  if (start >= end) {
    return "Classes start time must be before classes end time.";
  }
  if (opens > start) {
    return "School open time should be at or before classes start.";
  }
  if (end > closes) {
    return "School close time should be at or after classes end.";
  }
  if (end - start < 30) {
    return "Class day must be at least 30 minutes long.";
  }
  return null;
}

export function buildMorningReminderSlots(
  hours: SchoolDayHours,
): MorningReminderSlot[] {
  const startMins = parseClockToMinutes(hours.classesStartAt);
  if (startMins == null) return [];

  const startLabel = formatMinutesAsClock(startMins);

  return hours.morningReminderOffsetsMinutes
    .map((offset) => {
      const fireMins = startMins - offset;
      if (fireMins < 0) return null;
      const fireAt = formatMinutesAsClock(fireMins);
      const mins = offset;
      const hoursLeft = Math.floor(mins / 60);
      const remMins = mins % 60;
      const remainingLabel =
        hoursLeft > 0 && remMins > 0
          ? `${hoursLeft}h ${remMins}m`
          : hoursLeft > 0
            ? `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}`
            : `${remMins} minute${remMins === 1 ? "" : "s"}`;

      let title: string;
      let body: string;
      if (mins >= 90) {
        title = "Don't be late · school day starts soon";
        body = `Classes begin at ${startLabel} (in ${remainingLabel}). Start getting ready now so you leave on time.`;
      } else if (mins >= 55) {
        // Second nudge (~30 min after the 90-min alert when defaults are [90, 60]).
        title = `Leave soon · ${remainingLabel} to class`;
        body = `Classes start at ${startLabel}. You should be heading out or almost ready — don't run late.`;
      } else if (mins >= 45) {
        title = `Leave soon · ${remainingLabel} left`;
        body = `Classes start at ${startLabel}. Finish getting ready so you are not late.`;
      } else {
        title = `Almost late · ${remainingLabel} to class`;
        body = `Classes start at ${startLabel}. Head out now so you arrive on time.`;
      }

      return {
        offsetMinutes: mins,
        fireAt,
        minutesUntilClassStart: mins,
        label: remainingLabel,
        title,
        body,
      };
    })
    .filter((slot): slot is MorningReminderSlot => Boolean(slot))
    .sort((a, b) => b.offsetMinutes - a.offsetMinutes);
}

/** Compact payload for mobile/web clients. */
export function toSchoolDayHoursClientPayload(hours: SchoolDayHours) {
  const morningReminders = buildMorningReminderSlots(hours);
  return {
    ...hours,
    morningReminders,
    classWindowLabel: `${hours.classesStartAt} – ${hours.classesEndAt}`,
    schoolOpenLabel: `${hours.schoolOpensAt} – ${hours.schoolClosesAt}`,
  };
}
