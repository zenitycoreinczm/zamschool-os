import { format } from "date-fns";

import type { SubmissionStatus, StudentAttendanceSummary } from "@/components/student/dashboard/types";

const EMPTY_ATTENDANCE: StudentAttendanceSummary = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
  total: 0,
  rate: 0,
};

export function getEmptyAttendanceSummary(): StudentAttendanceSummary {
  return EMPTY_ATTENDANCE;
}

export function formatTimeRange(startTime: string | null, endTime: string | null) {
  if (!startTime && !endTime) return "Time not set";
  if (startTime && endTime) return `${startTime} - ${endTime}`;
  return startTime || endTime || "Time not set";
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy");
}

export function formatDateTimeLabel(value: string | null | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "MMM d, yyyy h:mm a");
}

export function formatSubmissionStatus(status: SubmissionStatus) {
  return status === "submitted" ? "Submitted" : "Pending";
}

export function submissionStatusPill(status: SubmissionStatus) {
  return status === "submitted"
    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
    : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200";
}
