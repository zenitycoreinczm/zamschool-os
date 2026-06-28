import type { AttendanceStatus } from "./status.ts";

export type { AttendanceStatus };

function normalizeAttendanceStatus(status: AttendanceStatus) {
  return String(status || "").trim().toLowerCase();
}

export function buildAttendanceUpsertRows(input: {
  schoolId: string;
  classId: string;
  markedBy: string;
  date: string;
  sessionName: string;
  sessionTime?: string | null;
  statuses: Array<{
    studentId: string;
    status: AttendanceStatus;
    remarks?: string | null;
  }>;
}) {
  return input.statuses.map((row) => ({
    school_id: input.schoolId,
    class_id: input.classId,
    student_id: row.studentId,
    date: input.date,
    attendance_date: input.date,
    session_name: input.sessionName,
    session_time: input.sessionTime || null,
    status: normalizeAttendanceStatus(row.status),
    remarks: row.remarks || null,
    notes: row.remarks || null,
    recorded_by: input.markedBy,
  }));
}
