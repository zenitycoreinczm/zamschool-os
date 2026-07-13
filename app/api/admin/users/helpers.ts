import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  mergeUserDirectoryRows,
  normalizeProfileGender,
} from "@/lib/admin-user-directory";
import { loadTeacherAccountDetail } from "@/lib/teacher-account-detail";
import { roleToStoredValue } from "@/lib/roles";
import {
  type UserCreateConflict,
  duplicateEmailConflict,
  duplicateEmployeeNumberConflict,
  duplicateStudentNumberConflict,
  mapUniqueViolationToUserCreateConflict,
} from "@/lib/user-create-conflicts";

export type { UserCreateConflict };
export { mapUniqueViolationToUserCreateConflict };

export async function loadUserDirectory(schoolId: string) {
  const profileSelect =
    "id, school_id, role, first_name, last_name, email, phone, avatar_url, gender, is_active, created_at, updated_at, admission_number, student_number, class_number, employee_id, employee_number, teacher_identifier, department, specialization, enrollment_date, class_id, status";
  const studentSelect =
    "id, profile_id, school_id, class_id, student_number, admission_number, class_number, enrollment_date, is_active, first_name, last_name";
  const teacherSelect =
    "id, profile_id, school_id, employee_number, employee_id, department, specialization, hire_date, is_active, teacher_identifier, phone";
  const parentSelect =
    "id, profile_id, school_id, occupation, relation_type, phone";

  const [profilesRes, studentsRes, teachersRes, parentsRes, classesRes] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(profileSelect)
        .eq("school_id", schoolId)
        .in("role", [
          "student",
          "STUDENT",
          "teacher",
          "TEACHER",
          "parent",
          "PARENT",
        ])
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("students")
        .select(studentSelect)
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("teachers")
        .select(teacherSelect)
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("parents")
        .select(parentSelect)
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId),
    ]);

  if (profilesRes.error) throw profilesRes.error;
  if (studentsRes.error) throw studentsRes.error;
  if (teachersRes.error) throw teachersRes.error;
  if (parentsRes.error && !isMissingRelationError(parentsRes.error))
    throw parentsRes.error;
  if (classesRes.error && !isMissingRelationError(classesRes.error))
    throw classesRes.error;

  const classNameById = Object.fromEntries(
    (classesRes.data || []).flatMap((row: any) => {
      const id = String(row?.id || "");
      const name = String(row?.name || "").trim();
      return id && name ? [[id, name]] : [];
    }),
  );

  return {
    ...mergeUserDirectoryRows({
      profiles: profilesRes.data || [],
      students: studentsRes.data || [],
      teachers: teachersRes.data || [],
      parents: parentsRes.data || [],
      classNameById,
    }),
  };
}

export async function loadPersonProfile(profileId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, school_id, role, first_name, last_name, email, avatar_url, is_active, created_at, updated_at",
    )
    .eq("id", profileId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) return null;
  return data;
}

export async function loadStudentRecord(profileId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "id, profile_id, admission_number, student_number, class_number, class_id, enrollment_date, admission_status, is_active",
    )
    .eq("school_id", schoolId)
    .or(`profile_id.eq.${profileId},id.eq.${profileId}`)
    .limit(1);

  if (error) return null;
  return Array.isArray(data) ? data[0] || null : data;
}

export async function loadTeacherRecord(profileId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("teachers")
    .select(
      "id, profile_id, employee_id, employee_number, department, specialization, hire_date, is_active",
    )
    .eq("school_id", schoolId)
    .or(`profile_id.eq.${profileId},id.eq.${profileId}`)
    .limit(1);

  if (error) return null;
  return Array.isArray(data) ? data[0] || null : data;
}

export async function loadParentRecord(profileId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id, phone, relation_type, occupation")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .limit(1);

  if (error) return null;
  return Array.isArray(data) ? data[0] || null : data;
}

export async function buildStudentDetail(baseProfile: any, schoolId: string) {
  const record = await loadStudentRecord(baseProfile.profileId, schoolId);
  return {
    ...baseProfile,
    admissionNumber: record?.admission_number || record?.student_number || null,
    classNumber: record?.class_number ?? null,
    classId: record?.class_id || null,
    enrollmentDate: record?.enrollment_date || null,
    admissionStatus: record?.admission_status || "registered",
    isActive: record?.is_active ?? baseProfile.status === "ACTIVE",
  };
}

export async function buildTeacherDetail(baseProfile: any, schoolId: string) {
  try {
    const detail = await loadTeacherAccountDetail({
      schoolId,
      profileId: baseProfile.profileId,
      baseProfile,
    });
    return detail;
  } catch {
    const record = await loadTeacherRecord(baseProfile.profileId, schoolId);
    return {
      ...baseProfile,
      employeeId: record?.employee_id || record?.employee_number || null,
      department: record?.department || null,
      specialization: record?.specialization || null,
      hireDate: record?.hire_date || null,
      isActive: record?.is_active ?? baseProfile.status === "ACTIVE",
    };
  }
}

export async function buildParentDetail(baseProfile: any, schoolId: string) {
  const record = await loadParentRecord(baseProfile.profileId, schoolId);
  return {
    ...baseProfile,
    phone: record?.phone || baseProfile.email || null,
    relationType: record?.relation_type || null,
    occupation: record?.occupation || null,
  };
}

export async function deleteParentRecords(profileId: string, schoolId: string) {
  // Find the parent record(s) for this profile so we can scope link deletion
  // to only this parent — deleting by school_id alone wipes every parent's
  // student links in the school.
  const { data: parentRows } = await supabaseAdmin
    .from("parents")
    .select("id")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId);

  const parentIds = (parentRows || [])
    .map((row: any) => String(row?.id || ""))
    .filter(Boolean);

  if (parentIds.length > 0) {
    await supabaseAdmin
      .from("parent_students")
      .delete()
      .eq("school_id", schoolId)
      .in("parent_id", parentIds);
  }

  await supabaseAdmin
    .from("parents")
    .delete()
    .eq("school_id", schoolId)
    .eq("profile_id", profileId);
}

export async function syncTeacherSpecializationRows(input: {
  schoolId: string;
  teacherProfileId: string;
  subjectIds?: string[];
}) {
  if (!input.subjectIds) return;

  await supabaseAdmin
    .from("teacher_subject_specializations")
    .delete()
    .eq("school_id", input.schoolId)
    .eq("teacher_profile_id", input.teacherProfileId);

  if (input.subjectIds.length === 0) return;

  const records = input.subjectIds.map((subjectId) => ({
    school_id: input.schoolId,
    teacher_profile_id: input.teacherProfileId,
    subject_id: subjectId,
  }));

  const { error } = await supabaseAdmin
    .from("teacher_subject_specializations")
    .insert(records);
  if (error && !isMissingRelationError(error)) {
    console.error("sync specialization error", error);
  }
}

export async function syncTeacherClassSubjectAssignments(input: {
  schoolId: string;
  teacherProfileId: string;
  teachingAssignments?: { classId: string; subjectId: string }[];
}) {
  if (!input.teachingAssignments) return;

  await supabaseAdmin
    .from("teacher_class_subject_assignments")
    .delete()
    .eq("school_id", input.schoolId)
    .eq("teacher_profile_id", input.teacherProfileId);

  if (input.teachingAssignments.length === 0) return;

  const records = input.teachingAssignments.map((assignment) => ({
    school_id: input.schoolId,
    teacher_profile_id: input.teacherProfileId,
    class_id: assignment.classId,
    subject_id: assignment.subjectId,
  }));

  const { error } = await supabaseAdmin
    .from("teacher_class_subject_assignments")
    .insert(records);
  if (error && !isMissingRelationError(error)) {
    console.error("sync assignment error", error);
  }
}

export async function syncTeacherSupervisedClasses(input: {
  schoolId: string;
  teacherProfileId: string;
  supervisedClassIds?: string[];
}) {
  if (!input.supervisedClassIds || input.supervisedClassIds.length === 0) return;

  const { error } = await supabaseAdmin
    .from("classes")
    .update({ supervisor_id: input.teacherProfileId })
    .eq("school_id", input.schoolId)
    .in("id", input.supervisedClassIds);

  if (error) {
    console.error("sync supervised classes error", error);
  }
}

export async function validateTeacherAssignmentInput(input: {
  schoolId: string;
  specializationSubjectIds?: string[];
  teachingAssignments?: { classId: string; subjectId: string }[];
  supervisedClassIds?: string[];
}) {
  const specializationSubjectIds = Array.isArray(input.specializationSubjectIds)
    ? input.specializationSubjectIds.filter(Boolean)
    : [];
  const teachingAssignments = Array.isArray(input.teachingAssignments)
    ? input.teachingAssignments.filter((a) => a.classId && a.subjectId)
    : [];
  const supervisedClassIds = Array.isArray(input.supervisedClassIds)
    ? input.supervisedClassIds.filter(Boolean)
    : [];

  for (const classId of [
    ...teachingAssignments.map((row) => row.classId),
    ...supervisedClassIds,
  ]) {
    await assertClassInSchool(input.schoolId, classId);
  }

  const specializationSummary =
    specializationSubjectIds.length > 0
      ? await resolveSubjectNames(input.schoolId, specializationSubjectIds)
      : null;

  return {
    specializationSubjectIds,
    teachingAssignments,
    supervisedClassIds,
    specializationSummary,
  };
}

export function assertTeacherHasClassAssignments(input: {
  teachingAssignments: { classId: string; subjectId: string }[];
  supervisedClassIds: string[];
}) {
  if (
    input.teachingAssignments.length > 0 ||
    input.supervisedClassIds.length > 0
  ) {
    return null;
  }
  return NextResponse.json(
    {
      error:
        "Assign this teacher to at least one class — add a teaching assignment (class + subject) or a class teacher responsibility.",
    },
    { status: 400 },
  );
}

export async function assertClassInSchool(schoolId: string, classId: string) {
  const normalized = String(classId || "").trim();
  if (!normalized) {
    throw new Error("Class is required.");
  }

  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id")
    .eq("school_id", schoolId)
    .eq("id", normalized)
    .maybeSingle();

  if (error) {
    console.error("assertClassInSchool", error);
    throw new Error("Failed to validate class assignment.");
  }

  if (!data?.id) {
    throw new Error(
      "Selected class was not found in this school. Choose a class from the list or create one first.",
    );
  }
}

export function emptyTeacherAssignmentInput() {
  return {
    specializationSubjectIds: [],
    teachingAssignments: [],
    supervisedClassIds: [],
    specializationSummary: null,
  };
}

export async function resolveSubjectNames(
  schoolId: string,
  subjectIds: string[],
): Promise<string | null> {
  if (subjectIds.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("name")
    .eq("school_id", schoolId)
    .in("id", subjectIds);

  if (error || !data) return null;

  const names = data
    .map((s: any) => String(s.name || "").trim())
    .filter(Boolean);
  return names.length > 0 ? names.join(", ") : null;
}

export function sanitizeProfileExtras(
  role: string,
  extras: Record<string, any>,
) {
  const cleaned: Record<string, any> = {};
  // Common fields
  if (extras.gender) {
    cleaned.gender =
      normalizeProfileGender(extras.gender) ||
      String(extras.gender).trim().toLowerCase();
  }
  if (extras.status) cleaned.status = String(extras.status).trim().toUpperCase();
  if (typeof extras.is_active === "boolean") cleaned.is_active = extras.is_active;
  else if (extras.status)
    cleaned.is_active = String(extras.status).toUpperCase() === "ACTIVE";
  // Teacher fields
  if (extras.employee_id)
    cleaned.employee_id = String(extras.employee_id).trim();
  if (extras.department) cleaned.department = String(extras.department).trim();
  if (extras.specialization)
    cleaned.specialization = String(extras.specialization).trim();
  if (extras.hire_date) cleaned.hire_date = String(extras.hire_date).trim();
  // Student fields
  if (extras.admission_number)
    cleaned.admission_number = String(extras.admission_number).trim();
  if (extras.class_id) cleaned.class_id = String(extras.class_id).trim();
  if (extras.enrollment_date)
    cleaned.enrollment_date = String(extras.enrollment_date).trim();
  // Class register number (roll call / results). Accept explicit value or
  // numeric admission / student number entered in the form.
  const explicitClassNumber = parseClassNumber(extras.class_number);
  const fromAdmission = parseClassNumber(extras.admission_number);
  const classNumber = explicitClassNumber ?? fromAdmission;
  if (classNumber != null) {
    cleaned.class_number = classNumber;
    // Keep legacy text columns aligned so older screens still show the number.
    if (!cleaned.admission_number) {
      cleaned.admission_number = String(classNumber);
    }
    cleaned.student_number = cleaned.admission_number;
  }
  return cleaned;
}

/** Parse a positive integer class/register number from form input. */
export function parseClassNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const raw = String(value).trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n > 0 ? n : null;
}

export function sanitizeParentExtras(extras?: Record<string, any>) {
  if (!extras) return {};
  const cleaned: Record<string, any> = {};
  if (extras.relation_type)
    cleaned.relation_type = String(extras.relation_type).trim();
  if (extras.occupation) cleaned.occupation = String(extras.occupation).trim();
  return cleaned;
}

export function buildDisplayName(profile: any): string {
  const first = String(profile?.first_name || "").trim();
  const last = String(profile?.last_name || "").trim();
  if (first || last) return `${first} ${last}`.trim();
  const name = String(profile?.name || "").trim();
  if (name) return name;
  const email = String(profile?.email || "").trim();
  if (email) return email.split("@")[0];
  return "User";
}

export function normalizeRoleValue(value: any): string {
  const stored = roleToStoredValue(value);
  if (stored) return stored;

  const raw = String(value || "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, string> = {
    instructor: "teacher",
    pupil: "student",
    guardian: "parent",
  };
  return aliases[raw] || raw;
}

export function isMissingRelationError(error: any): boolean {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("does not exist")
  );
}

/**
 * Fail fast before creating auth users when email / student number / employee
 * number would violate unique constraints.
 */
export async function findUserCreateConflict(input: {
  email: string;
  role: string;
  admissionNumber?: string | null;
  classNumber?: number | null;
  classId?: string | null;
  schoolId?: string | null;
  employeeId?: string | null;
}): Promise<UserCreateConflict | null> {
  const email = input.email.trim().toLowerCase();
  if (email) {
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, school_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (existingProfile?.id) {
      return duplicateEmailConflict();
    }
  }

  const schoolId = String(input.schoolId || "").trim();
  const admissionNumber = String(input.admissionNumber || "").trim();
  const classNumber =
    input.classNumber ?? parseClassNumber(input.admissionNumber);

  // Student / employee numbers are unique **per school**, never platform-wide.
  if (
    input.role === "student" &&
    schoolId &&
    (admissionNumber || classNumber != null)
  ) {
    const checks = [];
    if (admissionNumber) {
      checks.push(
        supabaseAdmin
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("student_number", admissionNumber)
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("students")
          .select("id")
          .eq("school_id", schoolId)
          .eq("admission_number", admissionNumber)
          .limit(1)
          .maybeSingle(),
      );
    }
    if (classNumber != null && input.classId) {
      checks.push(
        supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("school_id", schoolId)
          .eq("class_id", input.classId)
          .eq("class_number", classNumber)
          .in("role", ["student", "STUDENT"])
          .limit(1)
          .maybeSingle(),
      );
    }

    const results = await Promise.all(checks);
    if (results.some((r) => r.data?.id)) {
      return duplicateStudentNumberConflict(
        admissionNumber || String(classNumber),
      );
    }
  }

  const employeeId = String(input.employeeId || "").trim();
  if (input.role === "teacher" && employeeId && schoolId) {
    const [byEmployeeNumber, byEmployeeId] = await Promise.all([
      supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("school_id", schoolId)
        .eq("employee_number", employeeId)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("teachers")
        .select("id")
        .eq("school_id", schoolId)
        .eq("employee_id", employeeId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (byEmployeeNumber.data?.id || byEmployeeId.data?.id) {
      return duplicateEmployeeNumberConflict(employeeId);
    }
  }

  return null;
}

export function conflictResponse(conflict: UserCreateConflict) {
  return NextResponse.json(
    {
      error: conflict.error,
      code: conflict.code,
      field: conflict.field,
    },
    { status: conflict.status },
  );
}

/** Extract a missing column name from Postgres 42703 or PostgREST PGRST204. */
function extractMissingColumn(message: string): string | null {
  const pgMatch = message.match(
    /column\s+(?:[a-z_]+\.)?([a-zA-Z0-9_]+)\s+does not exist/i,
  );
  if (pgMatch?.[1]) return pgMatch[1];
  // PostgREST: Could not find the 'hire_date' column of 'profiles' in the schema cache
  const pgrstMatch = message.match(
    /Could not find the '([a-zA-Z0-9_]+)' column/i,
  );
  return pgrstMatch?.[1] || null;
}

function isMissingColumnError(error: {
  code?: string;
  message?: string;
}): boolean {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    /Could not find the '.*' column/i.test(message) ||
    message.includes("schema cache")
  );
}

export async function safeInsert(table: string, payload: Record<string, any>) {
  const MAX_RETRIES = 5;
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error } = await supabaseAdmin.from(table).insert(currentPayload);
    if (!error) return;

    if (isMissingColumnError(error)) {
      const column = extractMissingColumn(String(error?.message || ""));
      if (column && column in currentPayload) {
        delete currentPayload[column];
        continue;
      }
    }
    throw error;
  }
}

export async function safeInsertIfTableExists(
  table: string,
  payload: Record<string, any>,
) {
  try {
    await safeInsert(table, payload);
  } catch (error: any) {
    const message = String(error?.message || "");
    const code = String(error?.code || "");
    if (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("does not exist")
    ) {
      return;
    }
    throw error;
  }
}

export async function safeUpdateScoped(
  table: string,
  recordId: string,
  schoolId: string,
  payload: Record<string, any>,
) {
  const MAX_RETRIES = 5;
  let currentPayload = { ...payload };

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { error } = await supabaseAdmin
      .from(table)
      .update(currentPayload)
      .eq("id", recordId)
      .eq("school_id", schoolId);
    if (!error) return;

    if (isMissingColumnError(error)) {
      const column = extractMissingColumn(String(error?.message || ""));
      if (column && column in currentPayload) {
        delete currentPayload[column];
        continue;
      }
    }
    throw error;
  }
}

