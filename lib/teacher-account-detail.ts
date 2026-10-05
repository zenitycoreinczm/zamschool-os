import { formatLocalDateInputValue } from "./local-date.ts";
import { supabaseAdmin } from "./supabase.ts";
import { resolveLessonDayOfWeek } from "./lesson-day.ts";
import { buildTeacherAccountDetail } from "./teacher-account-detail-builder.ts";

export async function loadTeacherAccountDetail(input: {
  schoolId: string;
  profileId: string;
  baseProfile: Record<string, any>;
}) {
  const teacherRecord = await loadTeacherRecord(input.profileId, input.schoolId);
  const teacherKeys = Array.from(
    new Set([input.profileId, teacherRecord?.id].filter(Boolean))
  );
  const todayDate = formatLocalDateInputValue(new Date());
  const todayLessonDayOfWeek = resolveLessonDayOfWeek(todayDate);

  const [
    specializationRows,
    normalizedTeachingAssignments,
    supervisedClassRefs,
    directLessons,
    assignments,
    attendanceRows,
  ] = await Promise.all([
    loadTeacherSpecializationRows(input.schoolId, input.profileId),
    loadTeacherClassSubjectAssignments(input.schoolId, input.profileId),
    teacherKeys.length > 0
      ? safeRows(
          supabaseAdmin
            .from("classes")
            .select("id")
            .eq("school_id", input.schoolId)
            .in("supervisor_id", teacherKeys)
            .order("name", { ascending: true })
        )
      : Promise.resolve([]),
    teacherKeys.length > 0
      ? safeRows(
          supabaseAdmin
            .from("lessons")
            .select(
              `
                id,
                title,
                class_id,
                subject_id,
                day_of_week,
                start_time,
                end_time
              `
            )
            .eq("school_id", input.schoolId)
            .in("teacher_id", teacherKeys)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true })
        )
      : Promise.resolve([]),
    teacherKeys.length > 0
      ? safeRows(
          supabaseAdmin
            .from("assignments")
            .select(
              `
                id,
                title,
                class_id,
                subject_id,
                due_date,
                created_at
              `
            )
            .eq("school_id", input.schoolId)
            .in("teacher_id", teacherKeys)
            .order("created_at", { ascending: false })
            .limit(50)
        )
      : Promise.resolve([]),
    teacherKeys.length > 0
      ? safeRows(
          supabaseAdmin
            .from("attendance")
            .select(
              "id, class_id, date, session_name, session_time, status, created_at"
            )
            .eq("school_id", input.schoolId)
            .in("recorded_by", teacherKeys)
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(80)
        )
      : Promise.resolve([]),
  ]);

  const classIds = Array.from(
    new Set(
      [
        ...(normalizedTeachingAssignments || []).map((row: any) => row.class_id),
        ...(supervisedClassRefs || []).map((row: any) => row.id),
        ...(directLessons || []).map((row: any) => row.class_id),
        ...(assignments || []).map((row: any) => row.class_id),
      ].filter(Boolean)
    )
  );
  const supervisedClassIds = Array.from(
    new Set((supervisedClassRefs || []).map((row: any) => row.id).filter(Boolean))
  );
  const supervisedLessons =
    supervisedClassIds.length > 0
      ? await safeRows(
          supabaseAdmin
            .from("lessons")
            .select(
              `
                id,
                title,
                class_id,
                subject_id,
                day_of_week,
                start_time,
                end_time
              `
            )
            .eq("school_id", input.schoolId)
            .in("class_id", supervisedClassIds)
            .order("day_of_week", { ascending: true })
            .order("start_time", { ascending: true })
        )
      : [];
  const allLessons = dedupeRowsById([...(directLessons || []), ...(supervisedLessons || [])]);
  const subjectIds = Array.from(
    new Set(
      [
        ...(specializationRows || []).map((row: any) => row.subject_id),
        ...(normalizedTeachingAssignments || []).map((row: any) => row.subject_id),
        ...(allLessons || []).map((row: any) => row.subject_id),
        ...(assignments || []).map((row: any) => row.subject_id),
      ].filter(Boolean)
    )
  );
  const [classMap, subjects] = await Promise.all([
    getClassesById(input.schoolId, classIds),
    subjectIds.length > 0
      ? safeRows(
          supabaseAdmin
            .from("subjects")
            .select("id, name, code")
            .eq("school_id", input.schoolId)
            .in("id", subjectIds)
        )
      : Promise.resolve([]),
  ]);
  const subjectById = new Map((subjects || []).map((row: any) => [row.id, row]));

  const assignmentIds = Array.from(
    new Set((assignments || []).map((row: any) => row.id).filter(Boolean))
  );
  const resultRows =
    assignmentIds.length > 0
      ? await safeRows(
          supabaseAdmin
            .from("results")
            .select("id, assignment_id, student_id, score, grade, created_at")
            .eq("school_id", input.schoolId)
            .in("assignment_id", assignmentIds)
            .order("created_at", { ascending: false })
            .limit(80)
        )
      : [];
  const studentNamesById = await loadStudentNamesByStudentIds(
    input.schoolId,
    Array.from(
      new Set((resultRows || []).map((row: any) => row.student_id).filter(Boolean))
    )
  );

  return buildTeacherAccountDetail({
    baseProfile: input.baseProfile,
    teacherRecord,
    specializationRows,
    normalizedTeachingAssignments,
    supervisedClassRefs,
    directLessons: allLessons,
    assignments,
    attendanceRows,
    resultRows,
    studentNamesById,
    classMap,
    subjectById,
    todayDate,
    todayLessonDayOfWeek,
  });
}

async function loadTeacherRecord(profileId: string, schoolId: string) {
  return safeMaybeSingle(
    supabaseAdmin
      .from("teachers")
      .select(
        "id, profile_id, school_id, employee_id, employee_number, department, specialization, hire_date, is_active"
      )
      .eq("school_id", schoolId)
      .or(`profile_id.eq.${profileId},id.eq.${profileId}`)
      .limit(1)
  );
}

async function loadTeacherSpecializationRows(schoolId: string, profileId: string) {
  return safeRows(
    supabaseAdmin
      .from("teacher_subject_specializations")
      .select("subject_id")
      .eq("school_id", schoolId)
      .eq("teacher_profile_id", profileId)
  );
}

async function loadTeacherClassSubjectAssignments(
  schoolId: string,
  profileId: string
) {
  return safeRows(
    supabaseAdmin
      .from("teacher_class_subject_assignments")
      .select("class_id, subject_id")
      .eq("school_id", schoolId)
      .eq("teacher_profile_id", profileId)
  );
}

async function loadStudentNamesByStudentIds(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) {
    return new Map<string, string>();
  }

  const studentRows = await safeRows(
    supabaseAdmin
      .from("students")
      .select("id, profile_id")
      .eq("school_id", schoolId)
      .in("id", studentIds)
  );
  const profileIds = Array.from(
    new Set((studentRows || []).map((row: any) => row.profile_id).filter(Boolean))
  );
  const directProfiles = await safeRows(
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("school_id", schoolId)
      .in("id", studentIds)
  );
  const profiles =
    profileIds.length > 0
      ? await safeRows(
          supabaseAdmin
            .from("profiles")
            .select("id, first_name, last_name, email")
            .eq("school_id", schoolId)
            .in("id", profileIds)
        )
      : [];
  const profileById = new Map(
    [...(profiles || []), ...(directProfiles || [])].map((row: any) => [row.id, row])
  );

  const names = new Map<string, string>();
  for (const row of studentRows || []) {
    names.set(row.id, buildDisplayName(profileById.get(row.profile_id || "")));
    if (row.profile_id) {
      names.set(row.profile_id, buildDisplayName(profileById.get(row.profile_id || "")));
    }
  }

  for (const profile of directProfiles || []) {
    names.set(profile.id, buildDisplayName(profile));
  }

  return names;
}

async function getClassesById(schoolId: string | null, classIds: string[]) {
  if (!schoolId || classIds.length === 0) {
    return new Map<string, any>();
  }

  const withGrades = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level, grades(name, level)")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!withGrades.error) {
    return new Map((withGrades.data || []).map((row: any) => [row.id, row]));
  }

  const withoutGrades = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!withoutGrades.error) {
    return new Map((withoutGrades.data || []).map((row: any) => [row.id, row]));
  }

  const bare = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (bare.error) {
    throw bare.error;
  }

  return new Map((bare.data || []).map((row: any) => [row.id, row]));
}

function buildDisplayName(row: any) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.name ||
    row?.email ||
    "User"
  );
}

async function safeRows(query: PromiseLike<{ data?: any[] | null; error?: any }>) {
  const result = await query;
  if (result?.error) return [];
  return result?.data || [];
}

async function safeMaybeSingle(
  query: PromiseLike<{ data?: any[] | any | null; error?: any }>
) {
  const result = await query;
  if (result?.error) return null;
  if (Array.isArray(result?.data)) {
    return result.data[0] || null;
  }
  return result?.data || null;
}

function dedupeRowsById<T extends { id?: string | null }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = String(row?.id || "").trim();
    if (!id || seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}
