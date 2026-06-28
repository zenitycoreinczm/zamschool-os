import { buildAttendanceNotificationPayloads } from "./notifications";
import { loadParentProfileIdsByStudentRowId } from "./parent-recipients";
import type { AttendanceStatus } from "./status";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { supabaseAdmin } from "@/lib/supabase";

type SyncAttendanceNotificationsInput = {
  schoolId: string;
  teacherId: string;
  lesson: {
    id: string;
    title?: string | null;
    start_time?: string | null;
    subjects?: { name?: string | null; code?: string | null } | Array<{ name?: string | null; code?: string | null }> | null;
  };
  classRow: unknown;
  rosterRows: Array<{
    id: string;
    profile_id?: string | null;
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
    } | null;
  }>;
  statuses: Array<{ studentId: string; status: string; remarks?: string | null }>;
  date: string;
};

export async function syncAttendanceNotifications(input: SyncAttendanceNotificationsInput) {
  if (input.statuses.length === 0) {
    return { parentCount: 0, notificationCount: 0 };
  }

  const [{ data: teacherProfile, error: teacherError }, parentProfileIdsByStudentRowId] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", input.teacherId)
        .maybeSingle(),
      loadParentProfileIdsByStudentRowId({
        schoolId: input.schoolId,
        rosterRows: input.rosterRows,
      }),
    ]);

  if (teacherError) {
    throw teacherError;
  }

  const studentById = new Map(input.rosterRows.map((row) => [row.id, row]));
  const teacherName = buildDisplayName(teacherProfile || undefined, "Teacher");
  const className = buildClassLabel(input.classRow);
  const lessonName =
    input.lesson.title || getSubjectField(input.lesson.subjects, "name") || "Lesson";
  const timeLabel = input.lesson.start_time || null;

  const payloads = input.statuses.flatMap((row) => {
    const parentProfileIds = parentProfileIdsByStudentRowId.get(row.studentId) || [];
    const student = studentById.get(row.studentId);
    const studentProfileId = student?.profile_id || null;
    if (!studentProfileId) {
      return [];
    }

    return buildAttendanceNotificationPayloads({
      studentUserId: studentProfileId,
      studentId: row.studentId,
      lessonId: input.lesson.id,
      sessionTime: timeLabel,
      parents: parentProfileIds.map((id) => ({ id })),
      studentName: buildDisplayName(student?.profile, "Student"),
      className,
      lessonName,
      teacherName,
      date: input.date,
      timeLabel,
      status: row.status as AttendanceStatus,
    });
  });

  if (payloads.length === 0) {
    return { parentCount: 0, notificationCount: 0 };
  }

  await enqueueNotifications(input.schoolId, payloads);

  const parentCount = new Set(
    Array.from(parentProfileIdsByStudentRowId.values()).flat()
  ).size;

  return {
    parentCount,
    notificationCount: payloads.length,
  };
}

function buildDisplayName(
  row:
    | {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback: string
) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    fallback
  );
}

function buildClassLabel(classRow: any) {
  const className = typeof classRow?.name === "string" ? classRow.name.trim() : "";
  const gradeName =
    typeof classRow?.grades?.name === "string"
      ? classRow.grades.name.trim()
      : buildGradeLevelLabel(classRow?.grade_level);

  return [gradeName, className].filter(Boolean).join(" - ") || className || "Class";
}

function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : "";
}

function getSubjectField(
  subject:
    | { name?: string | null; code?: string | null }
    | Array<{ name?: string | null; code?: string | null }>
    | null
    | undefined,
  field: "name" | "code"
) {
  if (Array.isArray(subject)) {
    return subject[0]?.[field] || null;
  }

  return subject?.[field] || null;
}
