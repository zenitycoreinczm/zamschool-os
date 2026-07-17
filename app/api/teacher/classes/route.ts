import { NextResponse } from "next/server";

import {
  buildStudentRosterScope,
  canTeacherAccessLesson,
} from "@/lib/attendance/access";
import { buildAttendanceSessionKey } from "@/lib/live-schema-adapters";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveLessonDayOfWeek } from "@/lib/lesson-day";

const READ_MOSTLY_PRIVATE_CACHE =
  "private, max-age=30, stale-while-revalidate=120";

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "teacher-classes",
      schoolId,
      req,
      userId,
      preset: "teacherClasses",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const date =
      searchParams.get("date") || new Date().toISOString().slice(0, 10);
    const lessonDayOfWeek = resolveLessonDayOfWeek(date);

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    const supabaseAdmin = getSupabaseAdmin();
    // Class teachers see all periods for supervised classes; subject teachers
    // see their own periods plus any periods in classes they teach (full class access).
    const classIdsForAllLessons = Array.from(
      new Set([
        ...assignmentScope.supervisedClassIds,
        ...assignmentScope.taughtClassIds,
      ]),
    );
    const [taughtLessons, classScopedLessons] = await Promise.all([
      fetchLessonsByTeacherIds(supabaseAdmin, {
        schoolId,
        dayOfWeek: lessonDayOfWeek,
        teacherIds: assignmentScope.actorTeacherIds,
      }),
      fetchLessonsByClassIds(supabaseAdmin, {
        schoolId,
        dayOfWeek: lessonDayOfWeek,
        classIds: classIdsForAllLessons,
      }),
    ]);

    const lessons = dedupeLessonsById([...taughtLessons, ...classScopedLessons]);

    const classIds = Array.from(
      new Set(
        lessons
          .map((lesson: any) => lesson.class_id)
          .filter((value: string | null) => Boolean(value)),
      ),
    );

    const [studentRows, attendanceRows, classesById] = await Promise.all([
      getStudentsByClassIds(supabaseAdmin, { schoolId, classIds }),
      getAttendanceRows(supabaseAdmin, { schoolId, classIds, date }),
      getClassesById(supabaseAdmin, schoolId, classIds),
    ]);

    // Parent profile ids for mobile lock-screen / in-app attendance alerts.
    const parentProfileIdsByStudentId = await loadParentProfileIdsByStudentRows(
      supabaseAdmin,
      schoolId,
      studentRows,
    );

    const allowedLessons = lessons.filter((lesson: any) =>
      assignmentScope.actorTeacherIds.some((actorTeacherId) =>
        canTeacherAccessLesson({
          actorId: actorTeacherId,
          lessonTeacherId: lesson.teacher_id,
          classSupervisorId:
            classesById.get(lesson.class_id || "")?.supervisor_id || null,
          lessonSchoolId: lesson.school_id,
          actorSchoolId: schoolId,
          classId: lesson.class_id,
          allowedClassIds: assignmentScope.allowedClassIds,
        }),
      ),
    );

    const rosterByClass = new Map<string, any[]>();
    for (const row of studentRows) {
      const classId = row.class_id || "";
      if (!classId) continue;
      const existing = rosterByClass.get(classId) || [];
      existing.push(row);
      rosterByClass.set(classId, existing);
    }

    const attendanceByLessonStudent = new Map<string, any>();
    for (const row of attendanceRows) {
      attendanceByLessonStudent.set(
        buildAttendanceSessionKey({
          classId: row.class_id,
          studentId: row.student_id,
          sessionName: row.session_name,
          sessionTime: row.session_time,
        }),
        row,
      );
    }

    const data = allowedLessons.map((lesson: any) => {
      const rosterRows = rosterByClass.get(lesson.class_id) || [];
      const rosterStudentIds = buildStudentRosterScope({
        classId: lesson.class_id,
        students: rosterRows.map((row) => ({
          id: row.id,
          classId: row.class_id,
        })),
      });

      const baseSessionName =
        lesson.title || getSubjectField(lesson.subjects, "name") || "Lesson";
      const sessionType = detectSessionType(lesson.start_time);
      const sessionName = `${sessionType} - ${baseSessionName}`;
      const roster = rosterRows
        .filter((row) => rosterStudentIds.includes(row.id))
        .map((row) => {
          const saved = attendanceByLessonStudent.get(
            buildAttendanceSessionKey({
              classId: lesson.class_id,
              studentId: row.id,
              sessionName,
              sessionTime: lesson.start_time,
            }),
          );

          const parentIds = parentProfileIdsByStudentId.get(row.id) || [];
          return {
            id: row.id,
            profileId: row.profile_id || null,
            admissionNumber: row.student_number || null,
            displayName: buildDisplayName(row.profile),
            email: row.profile?.email || null,
            status: normalizeAttendanceStatus(saved?.status),
            remarks: saved?.remarks || saved?.notes || null,
            parentId: parentIds[0] || null,
            parentIds,
          };
        });

      return {
        id: lesson.id,
        date,
        classId: lesson.class_id,
        className: buildClassLabel(classesById.get(lesson.class_id || "")),
        subjectId: lesson.subject_id,
        subjectName:
          getSubjectField(lesson.subjects, "name") || lesson.title || "Subject",
        subjectCode: getSubjectField(lesson.subjects, "code"),
        dayOfWeek: lesson.day_of_week,
        startTime: lesson.start_time,
        endTime: lesson.end_time,
        room: null,
        rosterCount: roster.length,
        roster,
      };
    });

    return jsonWithPrivateCache({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to fetch teacher rollcall data"),
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Teachers cannot create classes from this endpoint" },
    { status: 405 },
  );
}

function jsonWithPrivateCache(payload: unknown) {
  const response = NextResponse.json(payload);
  response.headers.set("Cache-Control", READ_MOSTLY_PRIVATE_CACHE);
  return response;
}

async function fetchLessonsByTeacherIds(
  supabaseAdmin: any,
  input: {
    schoolId: string;
    dayOfWeek: number;
    teacherIds: string[];
  },
) {
  if (input.teacherIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      `
        id,
        school_id,
        class_id,
        teacher_id,
        subject_id,
        day_of_week,
        start_time,
        end_time,
        title,
        subjects(name, code)
      `,
    )
    .eq("school_id", input.schoolId)
    .eq("day_of_week", input.dayOfWeek)
    .in("teacher_id", input.teacherIds)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchLessonsByClassIds(
  supabaseAdmin: any,
  input: {
    schoolId: string;
    dayOfWeek: number;
    classIds: string[];
  },
) {
  if (input.classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      `
        id,
        school_id,
        class_id,
        teacher_id,
        subject_id,
        day_of_week,
        start_time,
        end_time,
        title,
        subjects(name, code)
      `,
    )
    .eq("school_id", input.schoolId)
    .eq("day_of_week", input.dayOfWeek)
    .in("class_id", input.classIds)
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

function dedupeLessonsById(lessons: any[]) {
  const seen = new Set<string>();
  return lessons.filter((lesson) => {
    const lessonId = String(lesson?.id || "").trim();
    if (!lessonId || seen.has(lessonId)) {
      return false;
    }

    seen.add(lessonId);
    return true;
  });
}

/**
 * Map students-row id → up to 2 parent profile ids (for push + inbox).
 */
async function loadParentProfileIdsByStudentRows(
  supabaseAdmin: any,
  schoolId: string,
  studentRows: Array<{ id: string; profile_id?: string | null }>,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!studentRows.length) return result;

  const studentIds = studentRows.map((row) => row.id).filter(Boolean);
  const profileIds = studentRows
    .map((row) => row.profile_id)
    .filter(Boolean) as string[];
  const linkKeys = Array.from(new Set([...studentIds, ...profileIds]));
  if (!linkKeys.length) return result;

  const { data: links, error: linksError } = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .in("student_id", linkKeys);

  if (linksError || !links?.length) return result;

  const parentIds = Array.from(
    new Set(links.map((row: any) => row.parent_id).filter(Boolean)),
  );
  if (!parentIds.length) return result;

  const { data: parents, error: parentsError } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .in("id", parentIds);

  if (parentsError || !parents?.length) return result;

  const profileByParentId = new Map<string, string>();
  for (const row of parents) {
    if (row.id && row.profile_id) {
      profileByParentId.set(String(row.id), String(row.profile_id));
    }
  }

  const studentRowByKey = new Map<string, string>();
  for (const row of studentRows) {
    studentRowByKey.set(String(row.id), String(row.id));
    if (row.profile_id) {
      studentRowByKey.set(String(row.profile_id), String(row.id));
    }
  }

  for (const link of links) {
    const studentRowId = studentRowByKey.get(String(link.student_id));
    const parentProfileId = profileByParentId.get(String(link.parent_id));
    if (!studentRowId || !parentProfileId) continue;
    const existing = result.get(studentRowId) || [];
    if (!existing.includes(parentProfileId)) existing.push(parentProfileId);
    result.set(studentRowId, existing.slice(0, 2));
  }

  return result;
}

async function getStudentsByClassIds(
  supabaseAdmin: any,
  input: {
    schoolId: string;
    classIds: string[];
  },
) {
  if (input.classIds.length === 0) {
    return [];
  }

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, school_id, student_number")
    .eq("school_id", input.schoolId)
    .in("class_id", input.classIds)
    .order("student_number", { ascending: true });

  if (studentsError) throw studentsError;

  const profileIds = Array.from(
    new Set((students || []).map((row: any) => row.profile_id).filter(Boolean)),
  );

  let profileById = new Map<string, any>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", profileIds);

    if (profilesError) throw profilesError;
    profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  }

  return (students || []).map((row: any) => ({
    ...row,
    profile: profileById.get(row.profile_id || "") || null,
  }));
}

async function getAttendanceRows(
  supabaseAdmin: any,
  input: {
    schoolId: string;
    classIds: string[];
    date: string;
  },
) {
  if (input.classIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select(
      "student_id, class_id, date, attendance_date, status, remarks, notes, session_name, session_time",
    )
    .eq("school_id", input.schoolId)
    .eq("date", input.date)
    .in("class_id", input.classIds);

  if (error) throw error;
  return data || [];
}

async function getClassesById(
  supabaseAdmin: any,
  schoolId: string | null,
  classIds: string[],
) {
  if (!schoolId || classIds.length === 0) {
    return new Map<string, any>();
  }

  const legacy = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level, supervisor_id")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!legacy.error) {
    return new Map((legacy.data || []).map((row: any) => [row.id, row]));
  }

  const modern = await supabaseAdmin
    .from("classes")
    .select("id, name, supervisor_id, grades(name, level)")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (modern.error) throw modern.error;

  return new Map((modern.data || []).map((row: any) => [row.id, row]));
}

function buildClassLabel(classRow: any) {
  const className =
    typeof classRow?.name === "string" ? classRow.name.trim() : "";
  const gradeName =
    typeof classRow?.grades?.name === "string"
      ? classRow.grades.name.trim()
      : buildGradeLevelLabel(classRow?.grade_level);

  return (
    [gradeName, className].filter(Boolean).join(" - ") || className || "Class"
  );
}

function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : "";
}

function buildDisplayName(row?: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    "Student"
  );
}

function normalizeAttendanceStatus(status: string | null | undefined) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  return normalized || null;
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

function detectSessionType(startTime: string | null | undefined): string {
  if (!startTime) return "Morning";
  const hour = parseInt(startTime.split(":")[0] || "0", 10);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
