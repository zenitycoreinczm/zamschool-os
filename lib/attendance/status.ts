export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "SICK",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export function isAttendanceStatus(value: string | null | undefined): value is AttendanceStatus {
  const normalized = String(value || "").trim().toUpperCase();
  return (ATTENDANCE_STATUSES as readonly string[]).includes(normalized);
}

export function formatAttendanceStatusLabel(status: string | null | undefined) {
  const normalized = String(status || "").trim().toUpperCase();
  switch (normalized) {
    case "PRESENT":
      return "present";
    case "ABSENT":
      return "absent";
    case "LATE":
      return "late";
    case "EXCUSED":
      return "excused";
    case "SICK":
      return "sick";
    default:
      return normalized ? normalized.toLowerCase() : "unmarked";
  }
}

/** 24h HH:MM(:SS) → 12h clock for parent-facing copy */
export function formatLessonClockTime(time?: string | null) {
  const raw = String(time || "").trim();
  if (!raw) return "";

  const parts = raw.split(":");
  if (parts.length < 2) return raw;

  const hour = Number.parseInt(parts[0] || "", 10);
  const minute = parts[1]?.slice(0, 2) || "00";
  if (Number.isNaN(hour)) return raw.slice(0, 5);

  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${ampm}`;
}

export function formatAttendanceSessionDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
