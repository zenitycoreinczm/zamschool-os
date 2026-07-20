import { loadParentProfileIdsByStudentRowId } from "@/lib/attendance/parent-recipients";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import { dispatchExpoPushToUsers } from "@/lib/push-dispatch";
import {
  buildExamCertificateNotificationPayloads,
  buildResultNotificationPayloads,
} from "@/lib/result-notifications";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type ResultPublishRow = {
  id: string;
  student_id: string;
  assignment_id?: string | null;
  assignments?:
    | {
        id?: string;
        title?: string | null;
        class_id?: string | null;
        subject_id?: string | null;
        teacher_id?: string | null;
        subjects?:
          | { name?: string | null; code?: string | null }
          | Array<{ name?: string | null; code?: string | null }>
          | null;
      }
    | Array<{
        id?: string;
        title?: string | null;
        class_id?: string | null;
        subject_id?: string | null;
        teacher_id?: string | null;
        subjects?:
          | { name?: string | null; code?: string | null }
          | Array<{ name?: string | null; code?: string | null }>
          | null;
      }>
    | null;
};

/**
 * Parent-first result release — same pattern as roll-call notifications.
 * Enqueues in-app notifications and best-effort Expo lock-screen pushes.
 */
export async function syncResultPublishNotifications(input: {
  schoolId: string;
  teacherId: string;
  publishedAt: string;
  rows: ResultPublishRow[];
  mode?: "exam" | "subject";
}): Promise<{
  parentCount: number;
  notificationCount: number;
  pushAttempted: boolean;
  linkedParents: number;
  reason?: string;
}> {
  if (input.rows.length === 0) {
    return {
      parentCount: 0,
      notificationCount: 0,
      pushAttempted: false,
      linkedParents: 0,
      reason: "No results to notify about.",
    };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const studentIds = Array.from(
    new Set(input.rows.map((row) => String(row.student_id || "").trim()).filter(Boolean)),
  );

  const [teacherById, teacherByAuth, studentRowsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", input.teacherId)
      .maybeSingle(),
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("auth_user_id", input.teacherId)
      .maybeSingle(),
    supabaseAdmin
      .from("students")
      .select("id, profile_id, school_id, class_id")
      .eq("school_id", input.schoolId)
      .in("id", studentIds),
  ]);

  if (studentRowsResult.error) throw studentRowsResult.error;

  const teacherProfile = teacherById.data || teacherByAuth.data || null;
  const teacherName = buildDisplayName(teacherProfile, "Teacher");
  const studentRows = studentRowsResult.data || [];

  const parentProfileIdsByStudentRowId = await loadParentProfileIdsByStudentRowId({
    schoolId: input.schoolId,
    rosterRows: studentRows.map((row) => ({
      id: row.id,
      profile_id: row.profile_id,
    })),
  });

  const linkedParents = Array.from(parentProfileIdsByStudentRowId.values()).reduce(
    (sum, ids) => sum + ids.length,
    0,
  );

  const classIds = Array.from(
    new Set(studentRows.map((row) => row.class_id).filter(Boolean) as string[]),
  );
  const subjectIds = Array.from(
    new Set(
      input.rows
        .map((row) => normalizeRelation(row.assignments)?.subject_id)
        .filter(Boolean) as string[],
    ),
  );

  const studentProfileIds = Array.from(
    new Set(studentRows.map((row) => row.profile_id).filter(Boolean) as string[]),
  );

  const [studentProfilesResult, classesResult, subjectsResult] = await Promise.all([
    studentProfileIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", studentProfileIds)
      : Promise.resolve({ data: [], error: null }),
    classIds.length > 0
      ? supabaseAdmin
          .from("classes")
          .select("id, name")
          .eq("school_id", input.schoolId)
          .in("id", classIds)
      : Promise.resolve({ data: [], error: null }),
    subjectIds.length > 0
      ? supabaseAdmin
          .from("subjects")
          .select("id, name, code")
          .eq("school_id", input.schoolId)
          .in("id", subjectIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentProfilesResult.error) throw studentProfilesResult.error;
  if (classesResult.error) throw classesResult.error;
  if (subjectsResult.error) throw subjectsResult.error;

  const studentById = new Map(studentRows.map((row) => [row.id, row]));
  const studentProfileById = new Map(
    (studentProfilesResult.data || []).map((row: any) => [row.id, row]),
  );
  const classById = new Map(
    (classesResult.data || []).map((row: any) => [row.id, row]),
  );
  const subjectById = new Map(
    (subjectsResult.data || []).map((row: any) => [row.id, row]),
  );

  const mode = input.mode || "exam";
  const payloads: Array<{
    user_id: string;
    dedupe_key: string;
    title: string;
    message: string;
    type: string;
  }> = [];

  if (mode === "subject") {
    for (const row of input.rows) {
      const student = studentById.get(row.student_id);
      if (!student) continue;
      const parentIds = parentProfileIdsByStudentRowId.get(row.student_id) || [];
      if (parentIds.length === 0) continue;

      const assignment = normalizeRelation(row.assignments);
      const subject =
        (assignment?.subject_id && subjectById.get(assignment.subject_id)) ||
        null;
      const subjectName =
        subject?.name ||
        getSubjectField(assignment?.subjects, "name") ||
        "Subject";
      const studentProfile = student.profile_id
        ? studentProfileById.get(student.profile_id)
        : null;

      payloads.push(
        ...buildResultNotificationPayloads({
          studentUserId: student.profile_id || "",
          studentId: row.student_id,
          resultId: row.id,
          parents: parentIds.map((id) => ({ id })),
          studentName: buildDisplayName(studentProfile, "Student"),
          className: classById.get(student.class_id || "")?.name || "Class",
          subjectName,
          assignmentTitle: assignment?.title || "Exam",
          teacherName,
          publishedAt: input.publishedAt,
        }).filter((payload) => parentIds.includes(payload.user_id)),
      );
    }
  } else {
    const groupedByStudent = new Map<
      string,
      { studentId: string; examTitle: string; subjectCount: number }
    >();

    for (const row of input.rows) {
      const assignment = normalizeRelation(row.assignments);
      const examTitle = assignment?.title || "Exam";
      const key = `${row.student_id}:${examTitle}`;
      if (!groupedByStudent.has(key)) {
        groupedByStudent.set(key, {
          studentId: row.student_id,
          examTitle,
          subjectCount: 0,
        });
      }
      groupedByStudent.get(key)!.subjectCount += 1;
    }

    for (const group of groupedByStudent.values()) {
      const student = studentById.get(group.studentId);
      if (!student) continue;
      const parentIds = parentProfileIdsByStudentRowId.get(group.studentId) || [];
      if (parentIds.length === 0) continue;

      const studentProfile = student.profile_id
        ? studentProfileById.get(student.profile_id)
        : null;

      payloads.push(
        ...buildExamCertificateNotificationPayloads({
          examTitle: group.examTitle,
          studentUserId: student.profile_id || "",
          studentId: group.studentId,
          parents: parentIds.map((id) => ({ id })),
          studentName: buildDisplayName(studentProfile, "Student"),
          className: classById.get(student.class_id || "")?.name || "Class",
          teacherName,
          publishedAt: input.publishedAt,
          subjectCount: group.subjectCount,
        }).filter((payload) => parentIds.includes(payload.user_id)),
      );
    }
  }

  if (payloads.length === 0) {
    return {
      parentCount: 0,
      notificationCount: 0,
      pushAttempted: false,
      linkedParents,
      reason:
        linkedParents === 0
          ? "No linked parents found for these students. Link parents in admin first."
          : "Results published, but no parent links matched the students in this set.",
    };
  }

  // DB check: announcement | fee_payment | attendance | exam_result | low_attendance | general
  const parentPayloads = payloads.map((p) => ({
    ...p,
    type: p.type === "results" ? "exam_result" : p.type || "exam_result",
  }));

  // In-app + lock-screen in parallel so a DB notification glitch does not
  // block Expo push (and vice versa).
  let pushAttempted = false;
  let pushSent = 0;
  let enqueueError: string | null = null;

  const enqueuePromise = enqueueNotifications(
    input.schoolId,
    parentPayloads,
  ).catch((err) => {
    console.error("[results] notification enqueue failed:", err);
    enqueueError = err instanceof Error ? err.message : "enqueue failed";
  });

  const pushPromise = dispatchExpoPushToUsers(
    input.schoolId,
    parentPayloads.map((p) => ({
      userId: p.user_id,
      title: p.title,
      body: p.message,
      type: "exam_result",
      tab: "results",
      data: { type: "exam_result", tab: "results" },
    })),
  )
    .then((pushResult) => {
      pushAttempted = pushResult.tokenCount > 0;
      pushSent = pushResult.sent;
      return pushResult;
    })
    .catch((err) => {
      console.error("[results] push fan-out failed:", err);
      return { sent: 0, tokenCount: 0 };
    });

  await Promise.all([enqueuePromise, pushPromise]);

  const parentCount = new Set(parentPayloads.map((p) => p.user_id)).size;

  return {
    parentCount,
    notificationCount: parentPayloads.length,
    pushAttempted,
    linkedParents,
    reason:
      enqueueError && !pushAttempted
        ? "Could not save in-app notifications and no device tokens were reached."
        : enqueueError
          ? "In-app notification save had an issue; push may still have been sent."
          : pushAttempted && pushSent === 0
            ? "Device tokens found but Expo reported no successful deliveries."
            : !pushAttempted
              ? "Parents notified in-app. No registered push tokens for those parents (open the parent app once with notifications on)."
              : undefined,
  };
}

function normalizeRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
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
  fallback: string,
) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    fallback
  );
}

function getSubjectField(
  subject:
    | { name?: string | null; code?: string | null }
    | Array<{ name?: string | null; code?: string | null }>
    | null
    | undefined,
  field: "name" | "code",
) {
  if (Array.isArray(subject)) {
    return subject[0]?.[field] || null;
  }
  return subject?.[field] || null;
}
