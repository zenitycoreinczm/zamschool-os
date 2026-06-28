export type AttendanceSummaryKey =
  | "PRESENT"
  | "ABSENT"
  | "LATE"
  | "EXCUSED"
  | "SICK";

export type AttendanceSummary = Record<AttendanceSummaryKey, number>;

export const ATTENDANCE_RANGE_DAYS = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
  "3y": 1095,
} as const;

export type AttendanceRangeKey = keyof typeof ATTENDANCE_RANGE_DAYS;

export const EMPTY_ATTENDANCE_SUMMARY: AttendanceSummary = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
  SICK: 0,
};

export function normalizeAttendanceRange(value: string | null | undefined): AttendanceRangeKey {
  return value && value in ATTENDANCE_RANGE_DAYS
    ? (value as AttendanceRangeKey)
    : "1m";
}

export function buildAttendanceWindow(
  rangeValue: string | null | undefined,
  endDateValue?: string | null
) {
  const range = normalizeAttendanceRange(rangeValue);
  const endDate = parseDateInput(endDateValue) || startOfUtcDay(new Date());
  const startDate = new Date(endDate);

  startDate.setUTCDate(startDate.getUTCDate() - (ATTENDANCE_RANGE_DAYS[range] - 1));

  return {
    range,
    startDate: formatDateInput(startDate),
    endDate: formatDateInput(endDate),
  };
}

export function summarizeAttendance(rows: Array<{ status: string | null | undefined }>) {
  return rows.reduce<AttendanceSummary>((acc, row) => {
    const key = String(row.status || "").toUpperCase() as AttendanceSummaryKey;
    if (key in acc) {
      acc[key] += 1;
    }
    return acc;
  }, { ...EMPTY_ATTENDANCE_SUMMARY });
}

function parseDateInput(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : startOfUtcDay(date);
}

function startOfUtcDay(date: Date) {
  const normalized = new Date(date);
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}
