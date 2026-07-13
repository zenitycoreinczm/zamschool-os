/**
 * Shared teacher assignment reference loader.
 * Batches profile lookups to avoid N+1 queries across admin routes.
 */

import { supabaseAdmin } from "@/lib/supabase";

export type TeacherProfileRef = {
  id: string;
  school_id: string | null;
  role: string | null;
};

export type TeacherRowRef = {
  id: string;
  profile_id: string | null;
  school_id: string | null;
};

export function isMissingRelationError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist")
  );
}

/**
 * Resolve teacher id (profile id or teachers row id) to profile + teacher rows.
 * Missing profile_ids are fetched in a single `.in()` query.
 */
export async function fetchTeacherAssignmentReferences(
  schoolId: string,
  teacherId: string | null | undefined,
): Promise<{
  teacherProfiles: TeacherProfileRef[];
  teacherRows: TeacherRowRef[];
}> {
  const normalizedTeacherId = String(teacherId || "").trim();
  if (!normalizedTeacherId) {
    return { teacherProfiles: [], teacherRows: [] };
  }

  const teacherProfiles: TeacherProfileRef[] = [];
  const teacherRows: TeacherRowRef[] = [];

  const { data: directProfile, error: directProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, school_id, role")
    .eq("id", normalizedTeacherId)
    .maybeSingle();

  if (directProfileError) throw directProfileError;
  if (directProfile) {
    teacherProfiles.push(directProfile as TeacherProfileRef);
  }

  const teacherRowResult = await supabaseAdmin
    .from("teachers")
    .select("id, profile_id, school_id")
    .eq("school_id", schoolId)
    .or(`id.eq.${normalizedTeacherId},profile_id.eq.${normalizedTeacherId}`);

  if (
    teacherRowResult.error &&
    !isMissingRelationError(teacherRowResult.error)
  ) {
    throw teacherRowResult.error;
  }

  for (const teacherRow of teacherRowResult.data || []) {
    teacherRows.push(teacherRow as TeacherRowRef);
  }

  const knownIds = new Set(teacherProfiles.map((p) => p.id));
  const missingProfileIds = Array.from(
    new Set(
      teacherRows
        .map((row) => row.profile_id)
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0 && !knownIds.has(id),
        ),
    ),
  );

  if (missingProfileIds.length > 0) {
    const { data: additionalProfiles, error: profileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, school_id, role")
        .in("id", missingProfileIds);

    if (profileError) throw profileError;
    for (const profile of additionalProfiles || []) {
      teacherProfiles.push(profile as TeacherProfileRef);
    }
  }

  return { teacherProfiles, teacherRows };
}
