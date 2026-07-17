/**
 * Roll-call time windows (school-local clock).
 *
 * - Teachers may only mark during the lesson period (start → end).
 * - After start + LATE_GRACE_MINUTES without a submission, the head teacher
 *   should be alerted that the teacher is late to class.
 */

export const LATE_TEACHER_ALERT_MINUTES = 10;

export type RollCallWindowStatus =
  | "upcoming"
  | "open"
  | "late"
  | "closed"
  | "wrong_day";

export type RollCallWindow = {
  status: RollCallWindowStatus;
  canMark: boolean;
  isLate: boolean;
  minutesUntilStart: number | null;
  minutesUntilEnd: number | null;
  minutesLate: number | null;
  label: string;
  message: string;
  schoolDate: string;
  schoolTime: string;
};

const DEFAULT_SCHOOL_TZ = "Africa/Lusaka";

/** School-local wall clock parts (no DST surprises for Zambia). */
export function getSchoolClock(
  now: Date = new Date(),
  timeZone: string = process.env.SCHOOL_TIMEZONE || DEFAULT_SCHOOL_TZ,
): { date: string; time: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "00";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  const hour = get("hour") === "24" ? "00" : get("hour");
  const minute = get("minute");

  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}`;
  const minutesOfDay = Number(hour) * 60 + Number(minute);

  return { date, time, minutesOfDay };
}

/** Parse "HH:MM" / "HH:MM:SS" → minutes from midnight. */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
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
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function evaluateRollCallWindow(input: {
  lessonDate: string;
  startTime: string | null | undefined;
  endTime: string | null | undefined;
  hasSubmission?: boolean;
  now?: Date;
  timeZone?: string;
  lateAfterMinutes?: number;
}): RollCallWindow {
  const lateAfter = input.lateAfterMinutes ?? LATE_TEACHER_ALERT_MINUTES;
  const clock = getSchoolClock(input.now, input.timeZone);
  const start = parseTimeToMinutes(input.startTime);
  const end = parseTimeToMinutes(input.endTime);

  const base = {
    schoolDate: clock.date,
    schoolTime: clock.time,
  };

  if (input.lessonDate !== clock.date) {
    const isFuture = input.lessonDate > clock.date;
    return {
      ...base,
      status: "wrong_day",
      canMark: false,
      isLate: false,
      minutesUntilStart: null,
      minutesUntilEnd: null,
      minutesLate: null,
      label: isFuture ? "Future date" : "Past date",
      message: isFuture
        ? "Roll call cannot be marked in advance for a future day."
        : "Roll call cannot be marked for a past day.",
    };
  }

  if (start == null || end == null) {
    // Missing timetable times — allow mark but surface warning.
    return {
      ...base,
      status: "open",
      canMark: true,
      isLate: false,
      minutesUntilStart: null,
      minutesUntilEnd: null,
      minutesLate: null,
      label: "Open",
      message: "Lesson times are missing on the timetable — marking is allowed.",
    };
  }

  const nowM = clock.minutesOfDay;
  const untilStart = start - nowM;
  const untilEnd = end - nowM;
  const lateBy = nowM - start;

  if (nowM < start) {
    return {
      ...base,
      status: "upcoming",
      canMark: false,
      isLate: false,
      minutesUntilStart: untilStart,
      minutesUntilEnd: untilEnd,
      minutesLate: null,
      label: "Not started",
      message: `Opens at ${formatMinutesAsClock(start)} (in ${untilStart} min).`,
    };
  }

  if (nowM > end) {
    return {
      ...base,
      status: "closed",
      canMark: false,
      isLate: lateBy >= lateAfter,
      minutesUntilStart: null,
      minutesUntilEnd: 0,
      minutesLate: Math.max(0, lateBy),
      label: "Closed",
      message: `Period ended at ${formatMinutesAsClock(end)}. Roll call is closed.`,
    };
  }

  // Inside period
  if (lateBy >= lateAfter && !input.hasSubmission) {
    return {
      ...base,
      status: "late",
      canMark: true,
      isLate: true,
      minutesUntilStart: 0,
      minutesUntilEnd: untilEnd,
      minutesLate: lateBy,
      label: "Late",
      message: `Class started ${lateBy} min ago — mark roll call now. Head Teacher is notified after ${lateAfter} min.`,
    };
  }

  return {
    ...base,
    status: "open",
    canMark: true,
    isLate: false,
    minutesUntilStart: 0,
    minutesUntilEnd: untilEnd,
    minutesLate: lateBy > 0 ? lateBy : 0,
    label: input.hasSubmission ? "Open · saved" : "Open",
    message:
      untilEnd != null
        ? `Window open until ${formatMinutesAsClock(end)} (${untilEnd} min left).`
        : "Window open.",
  };
}

export function shouldAlertHeadTeacherForLateRollCall(input: {
  window: RollCallWindow;
  hasSubmission: boolean;
}): boolean {
  if (input.hasSubmission) return false;
  if (input.window.status === "late") return true;
  // After period closed but never submitted and was late
  if (
    input.window.status === "closed" &&
    (input.window.minutesLate || 0) >= LATE_TEACHER_ALERT_MINUTES
  ) {
    return true;
  }
  return false;
}
