import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { supabaseAdmin } from "@/lib/supabase";

const ADMINISH_ROLES = [
  "PRINCIPAL",
  "principal",
  "DEPUTY_HEAD",
  "deputy_head",
  "PAYMENTS",
  "payments",
  // legacy DB values still stored as admin
  "ADMIN",
  "admin",
];
const PARENT_ROLES = ["PARENT", "parent"];
const STUDENT_ROLES = ["STUDENT", "student"];
const TEACHER_ROLES = ["TEACHER", "teacher"];

type ScopedStudentIdentity = {
  rowId: string;
  profileId: string;
};

export type TeacherMessagingAccess = {
  allowedProfileIds: string[];
  studentProfileIds: string[];
  parentProfileIds: string[];
  teacherProfileIds: string[];
  adminProfileIds: string[];
};

export async function loadTeacherMessagingAccess(input: {
  schoolId: string;
  actorProfileId: string;
}): Promise<TeacherMessagingAccess> {
  const scope = await loadTeacherAssignmentScope({
    schoolId: input.schoolId,
    actorProfileId: input.actorProfileId,
  });

  const scopedStudents = await loadScopedStudents(input.schoolId, scope.allowedClassIds);
  const studentIdentityKeys = uniqueValues(
    scopedStudents.flatMap((student) => [student.rowId, student.profileId])
  );

  const [parentProfileIds, teacherProfileIds, adminProfileIds] = await Promise.all([
    loadParentProfileIdsForStudents(input.schoolId, studentIdentityKeys),
    loadPeerTeacherProfileIds(input.schoolId, scope.allowedClassIds, input.actorProfileId),
    loadSameSchoolAdminProfileIds(input.schoolId),
  ]);

  const studentProfileIds = scopedStudents.map((student) => student.profileId);
  const allowedProfileIds = uniqueValues([
    ...studentProfileIds,
    ...parentProfileIds,
    ...teacherProfileIds,
    ...adminProfileIds,
  ]).filter((id) => id !== input.actorProfileId);

  return {
    allowedProfileIds,
    studentProfileIds,
    parentProfileIds,
    teacherProfileIds,
    adminProfileIds,
  };
}

export function assertTeacherMessageRecipientAllowed(
  accessData: TeacherMessagingAccess,
  recipientId: string
) {
  return accessData.allowedProfileIds.includes(String(recipientId || "").trim());
}

async function loadScopedStudents(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) {
    return [] as ScopedStudentIdentity[];
  }

  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, school_id")
    .eq("school_id", schoolId)
    .in("class_id", classIds);

  if (!studentError) {
    return (studentRows || [])
      .filter((row: any) => isNonEmptyString(row.id))
      .map((row: any) => ({
        rowId: String(row.id),
        profileId: String(row.profile_id || row.id),
      }))
      .filter((row) => isNonEmptyString(row.profileId));
  }

  if (!isSchemaCompatibilityError(studentError)) {
    throw studentError;
  }

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, class_id, school_id, role")
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .in("role", STUDENT_ROLES);

  if (profileError) {
    throw profileError;
  }

  return (profileRows || [])
    .filter((row: any) => isNonEmptyString(row.id))
    .map((row: any) => ({
      rowId: String(row.id),
      profileId: String(row.id),
    }));
}

async function loadParentProfileIdsForStudents(schoolId: string, studentIdentityKeys: string[]) {
  if (studentIdentityKeys.length === 0) {
    return [] as string[];
  }

  const parentLinksResult = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .in("student_id", studentIdentityKeys);

  if (parentLinksResult.error) {
    if (isSchemaCompatibilityError(parentLinksResult.error)) {
      return [];
    }
    throw parentLinksResult.error;
  }

  const parentIds = uniqueValues((parentLinksResult.data || []).map((row: any) => String(row.parent_id || "")));
  if (parentIds.length === 0) {
    return [];
  }

  const [parentRowsResult, directParentProfilesResult] = await Promise.all([
    supabaseAdmin
      .from("parents")
      .select("id, profile_id, school_id")
      .eq("school_id", schoolId)
      .in("id", parentIds),
    supabaseAdmin
      .from("profiles")
      .select("id, school_id, role")
      .eq("school_id", schoolId)
      .in("id", parentIds)
      .in("role", PARENT_ROLES),
  ]);

  if (parentRowsResult.error && !isSchemaCompatibilityError(parentRowsResult.error)) {
    throw parentRowsResult.error;
  }

  if (directParentProfilesResult.error) {
    throw directParentProfilesResult.error;
  }

  return uniqueValues([
    ...(parentRowsResult.data || []).map((row: any) => String(row.profile_id || "")),
    ...(directParentProfilesResult.data || []).map((row: any) => String(row.id || "")),
  ]);
}

async function loadPeerTeacherProfileIds(
  schoolId: string,
  classIds: string[],
  actorProfileId: string
) {
  if (classIds.length === 0) {
    return [] as string[];
  }

  const [classRowsResult, lessonRowsResult, assignmentRowsResult] = await Promise.all([
    supabaseAdmin
      .from("classes")
      .select("id, supervisor_id, school_id")
      .eq("school_id", schoolId)
      .in("id", classIds),
    supabaseAdmin
      .from("lessons")
      .select("id, teacher_id, class_id, school_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds),
    supabaseAdmin
      .from("teacher_class_subject_assignments")
      .select("teacher_profile_id, class_id, school_id")
      .eq("school_id", schoolId)
      .in("class_id", classIds),
  ]);

  if (classRowsResult.error) throw classRowsResult.error;
  if (lessonRowsResult.error) throw lessonRowsResult.error;
  if (assignmentRowsResult.error && !isSchemaCompatibilityError(assignmentRowsResult.error)) {
    throw assignmentRowsResult.error;
  }

  const teacherKeys = uniqueValues([
    ...(classRowsResult.data || []).map((row: any) => String(row.supervisor_id || "")),
    ...(lessonRowsResult.data || []).map((row: any) => String(row.teacher_id || "")),
    ...(assignmentRowsResult.data || []).map((row: any) => String(row.teacher_profile_id || "")),
  ]).filter((id) => id && id !== actorProfileId);

  if (teacherKeys.length === 0) {
    return [];
  }

  const [teacherRowsById, teacherRowsByProfile, directTeacherProfiles] = await Promise.all([
    supabaseAdmin
      .from("teachers")
      .select("id, profile_id, school_id")
      .eq("school_id", schoolId)
      .in("id", teacherKeys),
    supabaseAdmin
      .from("teachers")
      .select("id, profile_id, school_id")
      .eq("school_id", schoolId)
      .in("profile_id", teacherKeys),
    supabaseAdmin
      .from("profiles")
      .select("id, school_id, role")
      .eq("school_id", schoolId)
      .in("id", teacherKeys)
      .in("role", TEACHER_ROLES),
  ]);

  if (teacherRowsById.error && !isSchemaCompatibilityError(teacherRowsById.error)) {
    throw teacherRowsById.error;
  }
  if (teacherRowsByProfile.error && !isSchemaCompatibilityError(teacherRowsByProfile.error)) {
    throw teacherRowsByProfile.error;
  }
  if (directTeacherProfiles.error) {
    throw directTeacherProfiles.error;
  }

  return uniqueValues([
    ...(teacherRowsById.data || []).map((row: any) => String(row.profile_id || "")),
    ...(teacherRowsByProfile.data || []).map((row: any) => String(row.profile_id || "")),
    ...(directTeacherProfiles.data || []).map((row: any) => String(row.id || "")),
  ]).filter((id) => id !== actorProfileId);
}

async function loadSameSchoolAdminProfileIds(schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, school_id, role")
    .eq("school_id", schoolId)
    .in("role", ADMINISH_ROLES);

  if (error) {
    throw error;
  }

  return uniqueValues((data || []).map((row: any) => String(row.id || "")));
}

function isSchemaCompatibilityError(
  error: { code?: string | null; message?: string | null } | null | undefined
) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (code === "42P01" || code === "42703" || code === "PGRST204" || code === "PGRST205") {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("could not find the") ||
    (message.includes("column") && message.includes("not found"))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
