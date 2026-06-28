import {
  formatAttendanceSessionDate,
  formatAttendanceStatusLabel,
  formatLessonClockTime,
  type AttendanceStatus,
} from "./status.ts";
function normalizeSessionTime(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, 5);
}

export type AttendanceNotificationStatus = AttendanceStatus;

export function buildAttendanceNotificationPayloads(input: {
  studentUserId: string;
  studentId: string;
  lessonId: string;
  sessionTime?: string | null;
  parents: Array<{ id: string }>;
  studentName: string;
  className: string;
  lessonName: string;
  teacherName: string;
  date: string;
  timeLabel?: string | null;
  status: AttendanceNotificationStatus;
}) {
  const statusLabel = formatAttendanceStatusLabel(input.status);
  const clock = formatLessonClockTime(input.timeLabel);
  const sessionDate = formatAttendanceSessionDate(input.date);
  const sessionTimeKey = normalizeSessionTime(input.sessionTime || input.timeLabel);

  const isPresent = input.status === "PRESENT";
  const title = isPresent
    ? `${input.studentName} is present in ${input.lessonName}`
    : `${input.studentName} is ${statusLabel} in ${input.lessonName}`;

  const messageParts = [
    isPresent
      ? `${input.studentName} is present in ${input.lessonName}`
      : `${input.studentName} was marked ${statusLabel} in ${input.lessonName}`,
    input.className ? `(${input.className})` : "",
    clock ? `at ${clock}` : "",
    `on ${sessionDate}`,
    `· Teacher: ${input.teacherName}`,
  ].filter(Boolean);

  const message = messageParts.join(" ").replace(/\s+/g, " ").trim();

  const parentIds = input.parents.map((parent) => parent.id).filter(Boolean);
  const recipientIds = parentIds.length > 0
    ? [input.studentUserId, ...parentIds]
    : [input.studentUserId].filter(Boolean);

  return Array.from(new Set(recipientIds)).map((recipientId) => {
    const isStudent = recipientId === input.studentUserId;
    const dedupeKeyParts = [
      isStudent ? input.studentUserId : recipientId,
      input.studentId,
      input.lessonId,
      input.date,
      sessionTimeKey || "na",
      input.status,
    ];
    return {
      user_id: recipientId,
      dedupe_key: dedupeKeyParts.join(":"),
      title,
      message,
      type: "attendance",
    };
  });
}
