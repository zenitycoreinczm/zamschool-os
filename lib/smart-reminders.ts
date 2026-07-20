/**
 * Smart reminder policy — shared product rules for web + mobile.
 *
 * Morning (student/parent): don't-be-late nudges before classesStartAt.
 * Class (teacher/student): prepare for next period from the timetable.
 */

/** Primary “don’t be late for school” pair: 1h30 before, then 30 min later. */
export const SCHOOL_LATE_REMINDER_OFFSETS_MIN = [90, 60] as const;

/** Minutes before each timetable lesson. */
export const CLASS_PREP_REMINDER_MINUTES = 5;

export type SmartReminderAudience =
  | "student"
  | "parent"
  | "teacher"
  | "staff";

export function schoolLateReminderCopy(input: {
  classesStartAt: string;
  offsetMinutes: number;
  audience?: SmartReminderAudience;
}) {
  const start = String(input.classesStartAt || "08:00").slice(0, 5);
  const mins = Math.max(1, Math.round(input.offsetMinutes));
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  const label =
    hours > 0 && rem > 0
      ? `${hours}h ${rem}m`
      : hours > 0
        ? `${hours} hour${hours === 1 ? "" : "s"}`
        : `${rem} minute${rem === 1 ? "" : "s"}`;

  const forParent = input.audience === "parent";

  if (mins >= 85) {
    return {
      title: forParent
        ? "Get children ready · school soon"
        : "Don't be late · school day starts soon",
      body: forParent
        ? `Classes begin at ${start} (in ${label}). Help your child leave on time.`
        : `Classes begin at ${start} (in ${label}). Start getting ready so you leave on time.`,
    };
  }

  if (mins >= 50) {
    return {
      title: forParent
        ? `Leave soon · ${label} to class`
        : `Leave soon · ${label} to class`,
      body: forParent
        ? `Classes start at ${start}. Your child should be heading out or almost ready.`
        : `Classes start at ${start}. You should be heading out or almost ready — don't run late.`,
    };
  }

  return {
    title: `Almost late · ${label} to class`,
    body: forParent
      ? `Classes start at ${start}. Ensure your child is on the way now.`
      : `Classes start at ${start}. Head out now so you arrive on time.`,
  };
}

export function classPrepReminderCopy(input: {
  audience: "teacher" | "student";
  subjectName?: string;
  className?: string;
  startTime?: string;
  room?: string;
  minutesBefore?: number;
}) {
  const mins = input.minutesBefore ?? CLASS_PREP_REMINDER_MINUTES;
  const subject = String(input.subjectName || "Class").trim();
  const className = String(input.className || "").trim();
  const room = String(input.room || "").trim();
  const start = String(input.startTime || "").slice(0, 5);

  if (input.audience === "teacher") {
    const title = className
      ? `Teach in ${mins} min · ${className}`
      : `Class in ${mins} min · ${subject}`;
    const bits = [
      subject && className ? subject : null,
      start ? `starts ${start}` : null,
      room ? `Room ${room}` : null,
    ].filter(Boolean);
    const body = bits.length
      ? `${bits.join(" · ")}. Prepare materials and open Attendance when the period starts.`
      : `Your next class is in ${mins} minutes. Prepare and open Attendance when it starts.`;
    return { title, body };
  }

  const title = `Almost late · ${subject} in ${mins} min`;
  const bits = [
    className || null,
    start ? `starts ${start}` : null,
    room ? `Room ${room}` : null,
  ].filter(Boolean);
  const body = bits.length
    ? `${bits.join(" · ")}. Head to class now so you arrive on time.`
    : `Your next lesson is in ${mins} minutes. Head to class so you are not late.`;
  return { title, body };
}
