import { supabaseAdmin } from "@/lib/supabase";
import { buildTeacherAssignmentScope } from "@/lib/teacher-assignment-scope";

export async function loadTeacherAssignmentScope(input: {
  schoolId: string;
  actorProfileId: string;
}) {
  const { data: teacherRows, error: teacherError } = await supabaseAdmin
    .from("teachers")
    .select("id, profile_id")
    .eq("school_id", input.schoolId)
    .eq("profile_id", input.actorProfileId);

  if (teacherError) {
    if (!isMissingRelationError(teacherError)) throw teacherError;
  }

  const normalizedTeacherRows = teacherRows || [];

  const scopeWithActors = buildTeacherAssignmentScope({
    actorProfileId: input.actorProfileId,
    schoolId: input.schoolId,
    teachers: normalizedTeacherRows,
    classes: [],
    lessons: [],
    assignments: [],
  });

  // Teaching assignments key off profile id; class teacher / lessons may use
  // either profile id or teachers.id (both live in actorTeacherIds).
  const actorProfileIds = Array.from(
    new Set(
      [input.actorProfileId, ...scopeWithActors.actorTeacherIds].filter(Boolean),
    ),
  );

  const [classesResult, lessonsResult, assignmentsResult] = await Promise.all([
    scopeWithActors.actorTeacherIds.length > 0
      ? supabaseAdmin
          .from("classes")
          .select("id, school_id, supervisor_id")
          .eq("school_id", input.schoolId)
          .in("supervisor_id", scopeWithActors.actorTeacherIds)
      : Promise.resolve({ data: [], error: null }),
    scopeWithActors.actorTeacherIds.length > 0
      ? supabaseAdmin
          .from("lessons")
          .select("id, school_id, class_id, teacher_id")
          .eq("school_id", input.schoolId)
          .in("teacher_id", scopeWithActors.actorTeacherIds)
      : Promise.resolve({ data: [], error: null }),
    actorProfileIds.length > 0
      ? supabaseAdmin
          .from("teacher_class_subject_assignments")
          .select("school_id, class_id, teacher_profile_id")
          .eq("school_id", input.schoolId)
          .in("teacher_profile_id", actorProfileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (classesResult.error) throw classesResult.error;
  if (lessonsResult.error) throw lessonsResult.error;
  if (assignmentsResult.error) {
    if (!isMissingRelationError(assignmentsResult.error)) throw assignmentsResult.error;
  }

  return buildTeacherAssignmentScope({
    actorProfileId: input.actorProfileId,
    schoolId: input.schoolId,
    teachers: normalizedTeacherRows,
    classes: classesResult.data || [],
    lessons: lessonsResult.data || [],
    assignments: assignmentsResult.data || [],
  });
}

function isMissingRelationError(error: { code?: string | null; message?: string | null }) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || message.includes("does not exist");
}
