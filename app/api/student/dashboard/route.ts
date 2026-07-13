import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { withCache, CACHE_CONFIGS } from "@/lib/enhanced-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireStudentContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveLessonDayOfWeek } from "@/lib/lesson-day";

const EMPTY_ATTENDANCE_SUMMARY = {
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
  total: 0,
  rate: 0,
};

export async function GET(req: Request) {
  try {
    const access = await requireStudentContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "student-dashboard",
      schoolId,
      req,
      userId,
      preset: "heavyRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

    const dashboardData = await withCache(
      `student:${userId}:${schoolId}:${date}`,
      async () => {
        const lessonDayOfWeek = resolveLessonDayOfWeek(date);

        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select(
            "id, email, first_name, last_name, school_id, admission_number, student_number, class_number, class_id, grade_id",
          )
          .eq("id", userId)
          .eq("school_id", schoolId)
          .maybeSingle();

        if (profileError) throw profileError;

        const legacyStudent = await loadLegacyStudentRecord(userId, schoolId);

        const classId = profile?.class_id || legacyStudent?.classId || null;
        const admissionNumber =
          profile?.admission_number ||
          profile?.student_number ||
          legacyStudent?.studentNumber ||
          null;
        const classNumber =
          typeof profile?.class_number === "number"
            ? profile.class_number
            : parseDashboardClassNumber(profile?.student_number) ??
              parseDashboardClassNumber(profile?.admission_number) ??
              parseDashboardClassNumber(legacyStudent?.studentNumber);
        const { classRow, gradeLabel } = await loadClassContext(classId, profile?.grade_id ?? null);

        const baseProfile = {
          id: userId,
          fullName: buildDisplayName(profile),
          email: profile?.email || null,
          admissionNumber,
          classNumber,
          classId,
          className: classRow?.name || null,
          gradeLabel,
        };

        if (!classId) {
          return {
            profile: baseProfile,
            todayLessons: [],
            attendance: {
              summary: EMPTY_ATTENDANCE_SUMMARY,
              rows: [],
            },
            assignments: {
              total: 0,
              urgent: 0,
              rows: [],
            },
          };
        }

        const attendanceState = await loadAttendanceState({
          schoolId,
          profileId: userId,
          legacyStudentId: legacyStudent?.studentId || null,
        });

        const attendanceLessonIds = attendanceState.hasLessonId
          ? Array.from(
              new Set(
                attendanceState.rows
                  .map((row: any) => row.lesson_id)
                  .filter(Boolean)
              )
            )
          : [];

        const [lessonsResult, assignmentsResult, attendanceLessonsResult] = await Promise.all([
          supabaseAdmin
            .from("lessons")
            .select("id, class_id, subject_id, teacher_id, start_time, end_time, day_of_week")
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .eq("day_of_week", lessonDayOfWeek)
            .order("start_time", { ascending: true }),
          supabaseAdmin
            .from("assignments")
            .select(
              `
                id,
                title,
                due_date,
                total_marks,
                description,
                subject_id,
                teacher_id
              `
            )
            .eq("school_id", schoolId)
            .eq("class_id", classId)
            .gte("due_date", date)
            .order("due_date", { ascending: true })
            .limit(8),
          attendanceLessonIds.length > 0
            ? supabaseAdmin
                .from("lessons")
                .select("id, class_id, subject_id, teacher_id, start_time, end_time")
                .eq("school_id", schoolId)
                .in("id", attendanceLessonIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (lessonsResult.error) throw lessonsResult.error;
        if (assignmentsResult.error) throw assignmentsResult.error;
        if (attendanceLessonsResult.error) throw attendanceLessonsResult.error;

        const attendanceLessons = attendanceLessonsResult.data || [];

        const teacherIds = Array.from(
          new Set(
            [
              ...(lessonsResult.data || []).map((lesson: any) => lesson.teacher_id),
              ...attendanceLessons.map((lesson: any) => lesson.teacher_id),
              ...(assignmentsResult.data || []).map((assignment: any) => assignment.teacher_id),
            ].filter(Boolean)
          )
        );

        const subjectIds = Array.from(
          new Set(
            [
              ...(lessonsResult.data || []).map((lesson: any) => lesson.subject_id),
              ...attendanceLessons.map((lesson: any) => lesson.subject_id),
              ...(assignmentsResult.data || []).map((assignment: any) => assignment.subject_id),
            ].filter(Boolean)
          )
        );

        const [teachersResult, subjectsResult] = await Promise.all([
          teacherIds.length > 0
            ? supabaseAdmin
                .from("profiles")
                .select("id, first_name, last_name, email")
                .eq("school_id", schoolId)
                .in("id", teacherIds)
            : Promise.resolve({ data: [], error: null }),
          subjectIds.length > 0
            ? supabaseAdmin
                .from("subjects")
                .select("id, name, code")
                .eq("school_id", schoolId)
                .in("id", subjectIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (teachersResult.error) throw teachersResult.error;
        if (subjectsResult.error) throw subjectsResult.error;

        const teacherMap = new Map<string, string>();
        for (const teacher of teachersResult.data || []) {
          teacherMap.set(teacher.id, buildDisplayName(teacher));
        }

        const subjectMap = new Map<string, { name: string; code: string | null }>();
        for (const subject of subjectsResult.data || []) {
          subjectMap.set(subject.id, {
            name: subject.name || "Subject",
            code: subject.code || null,
          });
        }

        const assignmentIds = assignmentRowsToIds(assignmentsResult.data || []);
        const assignmentSubmissionsByAssignmentId = await getAssignmentSubmissionsByAssignmentId({
          schoolId,
          studentProfileId: userId,
          assignmentIds,
        });

        const attendanceLessonMap = new Map<string, any>();
        for (const lesson of attendanceLessons) {
          attendanceLessonMap.set(lesson.id, lesson);
        }

        const classLabel = buildClassLabel({
          name: classRow?.name || null,
          gradeLabel,
        });

        const attendanceRows = attendanceState.rows.map((row) => {
          const lesson = row.lesson_id ? attendanceLessonMap.get(row.lesson_id) : null;
          const subject = lesson?.subject_id ? subjectMap.get(lesson.subject_id) : null;

          return {
            id: row.id,
            date: row.date,
            status: normalizeAttendanceStatus(row.status),
            remarks: row.remarks || "",
            subjectName: subject?.name || "Attendance record",
            className: classLabel,
            teacherName: teacherMap.get(lesson?.teacher_id) || "Teacher pending",
            startTime: lesson?.start_time || null,
            endTime: lesson?.end_time || null,
          };
        });

        const attendanceSummary = buildAttendanceSummary(attendanceRows);
        const todayLessons = (lessonsResult.data || []).map((lesson: any) => {
          const subject = lesson.subject_id ? subjectMap.get(lesson.subject_id) : null;

          return {
            id: lesson.id,
            subjectName: subject?.name || "Subject",
            subjectCode: subject?.code || null,
            teacherName: teacherMap.get(lesson.teacher_id) || "Teacher pending",
            className: classLabel,
            startTime: lesson.start_time,
            endTime: lesson.end_time,
            isCurrent: isCurrentLesson(date, lesson.start_time, lesson.end_time),
          };
        });

        const assignmentRows = (assignmentsResult.data || []).map((assignment: any) => {
          const subject = assignment.subject_id ? subjectMap.get(assignment.subject_id) : null;
          const submission = assignmentSubmissionsByAssignmentId.get(assignment.id);

          return {
            id: assignment.id,
            title: assignment.title,
            dueDate: assignment.due_date,
            totalMarks: assignment.total_marks ?? null,
            description: assignment.description || "",
            subjectName: subject?.name || "General",
            subjectCode: subject?.code || null,
            teacherName: teacherMap.get(assignment.teacher_id) || "Teacher pending",
            urgent: isUrgentAssignment(assignment.due_date),
            submissionId: submission?.id || null,
            submissionText: submission?.submission_text || "",
            submissionLink: submission?.submission_link || null,
            submittedAt: submission?.submitted_at || null,
            updatedAt: submission?.updated_at || null,
            submissionStatus: submission ? "submitted" : "pending",
          };
        });

        return {
          profile: baseProfile,
          todayLessons,
          attendance: {
            summary: attendanceSummary,
            rows: attendanceRows,
          },
          assignments: {
            total: assignmentRows.length,
            urgent: assignmentRows.filter((row) => row.urgent).length,
            rows: assignmentRows,
          },
        };
      },
      {
        ...CACHE_CONFIGS.student.dashboard,
        tags: ["dashboard"],
      }
    );

    return jsonWithPrivateCache({
      success: true,
      data: dashboardData,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch student dashboard data") },
      { status: 500 }
    );
  }
}

function assignmentRowsToIds(rows: any[]) {
  return Array.from(new Set(rows.map((row: any) => row.id).filter(Boolean)));
}

async function getAssignmentSubmissionsByAssignmentId(input: {
  schoolId: string;
  studentProfileId: string;
  assignmentIds: string[];
}) {
  if (input.assignmentIds.length === 0) {
    return new Map<string, any>();
  }

  const { data, error } = await supabaseAdmin
    .from("assignment_submissions")
    .select("id, assignment_id, submission_text, submission_link, submitted_at, updated_at")
    .eq("school_id", input.schoolId)
    .eq("student_profile_id", input.studentProfileId)
    .in("assignment_id", input.assignmentIds);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.assignment_id, row]));
}

function jsonWithPrivateCache(payload: unknown) {
  const response = NextResponse.json(payload);
  return applyEdgeCacheHeaders(response, "dashboardRead");
}

async function loadLegacyStudentRecord(userId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, school_id, class_id, student_number, class_number")
    .eq("profile_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }

    return null;
  }

  return data
    ? {
        studentId: data.id,
        classId: data.class_id || null,
        studentNumber:
          data.class_number != null
            ? String(data.class_number)
            : data.student_number || null,
      }
    : null;
}

function parseDashboardClassNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const raw = String(value ?? "").trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n > 0 ? n : null;
}

async function loadClassContext(classId: string | null, gradeId: string | null) {
  if (!classId && !gradeId) {
    return {
      classRow: null,
      gradeLabel: null,
    };
  }

  if (!classId) {
    return {
      classRow: null,
      gradeLabel: await loadGradeLabel(gradeId),
    };
  }

  const legacyClass = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("id", classId)
    .maybeSingle();

  if (!legacyClass.error) {
    return {
      classRow: legacyClass.data,
      gradeLabel: buildGradeLevelLabel(legacyClass.data?.grade_level),
    };
  }

  if (!isMissingColumnError(legacyClass.error)) {
    throw legacyClass.error;
  }

  const latestClass = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_id")
    .eq("id", classId)
    .maybeSingle();

  if (latestClass.error) throw latestClass.error;

  return {
    classRow: latestClass.data,
    gradeLabel: await loadGradeLabel(latestClass.data?.grade_id || gradeId),
  };
}

async function loadGradeLabel(gradeId: string | null) {
  if (!gradeId) return null;

  const { data, error } = await supabaseAdmin
    .from("grades")
    .select("id, level, name")
    .eq("id", gradeId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }

    return null;
  }

  return buildGradeLabel(data);
}

async function loadAttendanceState(input: {
  schoolId: string;
  profileId: string;
  legacyStudentId: string | null;
}) {
  const attempt = await queryAttendanceRows({
    schoolId: input.schoolId,
    studentId: input.profileId,
  });

  if (
    attempt.rows.length === 0 &&
    input.legacyStudentId &&
    input.legacyStudentId !== input.profileId
  ) {
    return queryAttendanceRows({
      schoolId: input.schoolId,
      studentId: input.legacyStudentId,
    });
  }

  return attempt;
}

async function queryAttendanceRows(input: { schoolId: string; studentId: string }) {
  const withLesson = await supabaseAdmin
    .from("attendance")
    .select("id, date, status, remarks, lesson_id")
    .eq("school_id", input.schoolId)
    .eq("student_id", input.studentId)
    .order("date", { ascending: false })
    .limit(60);

  if (!withLesson.error) {
    return {
      hasLessonId: true,
      rows: withLesson.data || [],
    };
  }

  if (!isMissingColumnError(withLesson.error)) {
    throw withLesson.error;
  }

  const legacy = await supabaseAdmin
    .from("attendance")
    .select("id, date, status, remarks, created_at")
    .eq("school_id", input.schoolId)
    .eq("student_id", input.studentId)
    .order("date", { ascending: false })
    .limit(60);

  if (legacy.error) throw legacy.error;

  return {
    hasLessonId: false,
    rows: (legacy.data || []).map((row: any) => ({
      ...row,
      lesson_id: null,
    })),
  };
}

function buildDisplayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
} | null | undefined) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    "Student"
  );
}

function buildGradeLabel(
  grade:
    | {
        level?: string | number | null;
        name?: string | null;
      }
    | null
    | undefined
) {
  if (!grade) return null;

  const gradeName = String(grade.name || "").trim();
  if (gradeName) return gradeName;

  return buildGradeLevelLabel(grade.level);
}

function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : null;
}

function buildClassLabel(
  classRow:
    | {
        name?: string | null;
        gradeLabel?: string | null;
      }
    | null
    | undefined
) {
  const className = String(classRow?.name || "").trim();
  const gradeLabel = String(classRow?.gradeLabel || "").trim();
  return [gradeLabel, className].filter(Boolean).join(" - ") || className || "Class";
}

function normalizeAttendanceStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(normalized)) {
    return normalized;
  }
  return "ABSENT";
}

function buildAttendanceSummary(
  rows: Array<{
    status: string;
  }>
) {
  const summary = rows.reduce(
    (acc, row) => {
      if (row.status === "PRESENT") acc.PRESENT += 1;
      else if (row.status === "LATE") acc.LATE += 1;
      else if (row.status === "EXCUSED") acc.EXCUSED += 1;
      else acc.ABSENT += 1;
      return acc;
    },
    { ...EMPTY_ATTENDANCE_SUMMARY }
  );

  const total = summary.PRESENT + summary.ABSENT + summary.LATE + summary.EXCUSED;
  const presentLike = summary.PRESENT + summary.LATE + summary.EXCUSED;

  return {
    ...summary,
    total,
    rate: total > 0 ? Math.round((presentLike / total) * 100) : 0,
  };
}

function isCurrentLesson(dateValue: string, startTime: string | null, endTime: string | null) {
  const today = new Date().toISOString().slice(0, 10);
  if (dateValue !== today || !startTime || !endTime) return false;

  const now = new Date();
  const currentValue = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const startValue = startTime.slice(0, 5);
  const endValue = endTime.slice(0, 5);
  return currentValue >= startValue && currentValue <= endValue;
}

function isUrgentAssignment(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  const due = new Date(`${dueDate}T23:59:59.000Z`);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() - Date.now() <= 1000 * 60 * 60 * 24 * 2;
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "");
  return error?.code === "42703" || message.includes("does not exist");
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "");
  return error?.code === "PGRST205" || message.includes("schema cache");
}
