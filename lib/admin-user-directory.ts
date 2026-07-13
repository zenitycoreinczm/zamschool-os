export type ManagedUserRole = "student" | "teacher" | "parent";

type GenericRow = Record<string, any>;

type MergeInput = {
  profiles: GenericRow[];
  students: GenericRow[];
  teachers: GenericRow[];
  parents: GenericRow[];
  classNameById?: Record<string, string>;
};

type UserFormLike = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  admission_number: string;
  /** Class register number (optional string form of integer). */
  class_number?: string | number | null;
  class_id: string;
  enrollment_date: string;
  employee_id: string;
  department: string;
  specialization: string;
  hire_date: string;
  relation_type: string;
  occupation: string;
};

function parseClassNumberField(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const raw = String(value).trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n > 0 ? n : null;
}

export function normalizeProfileGender(value: unknown): "male" | "female" | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "male" || normalized === "female") {
    return normalized;
  }
  return null;
}

export function toActiveFlag(status: unknown): boolean {
  const normalized = String(status || "").trim().toUpperCase();
  return normalized !== "INACTIVE";
}

export function toDisplayStatus(isActive: unknown): "ACTIVE" | "INACTIVE" {
  return isActive === false ? "INACTIVE" : "ACTIVE";
}

export function mergeUserDirectoryRows(input: MergeInput) {
  const studentsByProfileId = new Map(input.students.map((row) => [String(row.profile_id || row.id), row]));
  const teachersByProfileId = new Map(input.teachers.map((row) => [String(row.profile_id || row.id), row]));
  const parentsByProfileId = new Map(input.parents.map((row) => [String(row.profile_id || row.id), row]));
  const classNameById = input.classNameById || {};

  const students: GenericRow[] = [];
  const teachers: GenericRow[] = [];
  const parents: GenericRow[] = [];

  for (const profile of input.profiles) {
    const role = String(profile.role || "").trim().toLowerCase();
    const profileId = String(profile.id || "");
    if (!profileId || (role !== "student" && role !== "teacher" && role !== "parent")) {
      continue;
    }

    if (role === "student") {
      const student = studentsByProfileId.get(profileId) || {};
      students.push({
        ...profile,
        ...student,
        id: profileId,
        profile_id: profileId,
        role_record_id: student.id || null,
        display_name: getDisplayName(profile),
        admission_number:
          student.admission_number ||
          student.student_number ||
          profile.admission_number ||
          (student.class_number != null ? String(student.class_number) : "") ||
          (profile.class_number != null ? String(profile.class_number) : "") ||
          "",
        class_number:
          student.class_number ??
          profile.class_number ??
          null,
        class_id: student.class_id || profile.class_id || "",
        class_name: classNameById[String(student.class_id || profile.class_id || "")] || profile.class_name || profile.class || "",
        enrollment_date: student.enrollment_date || profile.enrollment_date || "",
        gender: normalizeProfileGender(profile.gender),
        status: toDisplayStatus(student.is_active ?? profile.is_active),
      });
      continue;
    }

    if (role === "teacher") {
      const teacher = teachersByProfileId.get(profileId) || {};
      teachers.push({
        ...profile,
        ...teacher,
        id: profileId,
        profile_id: profileId,
        role_record_id: teacher.id || null,
        display_name: getDisplayName(profile),
        employee_id:
          teacher.employee_id ||
          teacher.employee_number ||
          teacher.teacher_identifier ||
          profile.employee_id ||
          "",
        department: teacher.department || profile.department || "",
        specialization: teacher.specialization || profile.specialization || "",
        hire_date: teacher.hire_date || profile.hire_date || "",
        gender: normalizeProfileGender(profile.gender),
        status: toDisplayStatus(teacher.is_active ?? profile.is_active),
      });
      continue;
    }

    const parent = parentsByProfileId.get(profileId) || {};
    parents.push({
      ...profile,
      ...parent,
      id: profileId,
      profile_id: profileId,
      role_record_id: parent.id || null,
      display_name: getDisplayName(profile),
      relation_type: parent.relation_type || "",
      occupation: parent.occupation || profile.occupation || "",
      gender: normalizeProfileGender(profile.gender),
      status: toDisplayStatus(profile.is_active),
    });
  }

  return { students, teachers, parents };
}

export function buildUserWritePlan(input: {
  role: ManagedUserRole;
  schoolId: string;
  profileId?: string | null;
  form: UserFormLike;
}) {
  const profile = {
    first_name: input.form.first_name.trim(),
    last_name: input.form.last_name.trim(),
    email: input.form.email.trim().toLowerCase(),
    phone: normalizeOptionalString(input.form.phone),
    gender: normalizeProfileGender(input.form.gender),
    is_active: toActiveFlag(input.form.status),
    school_id: input.schoolId,
    role: input.role,
  };

  if (input.role === "student") {
    const classNumber =
      parseClassNumberField(input.form.class_number) ??
      parseClassNumberField(input.form.admission_number);
    const numberText =
      normalizeOptionalString(input.form.admission_number) ||
      (classNumber != null ? String(classNumber) : null);

    return {
      profile: {
        ...profile,
        admission_number: numberText,
        student_number: numberText,
        class_number: classNumber,
        class_id: normalizeOptionalString(input.form.class_id),
        enrollment_date: normalizeOptionalString(input.form.enrollment_date),
      },
      roleRecord: compactRecord({
        profile_id: input.profileId || null,
        school_id: input.schoolId,
        class_id: normalizeOptionalString(input.form.class_id),
        student_number: numberText,
        admission_number: numberText,
        class_number: classNumber,
        enrollment_date: normalizeOptionalString(input.form.enrollment_date),
        is_active: toActiveFlag(input.form.status),
      }),
      parentRecord: null,
    };
  }

  if (input.role === "teacher") {
    return {
      profile: {
        ...profile,
        employee_id: normalizeOptionalString(input.form.employee_id),
      },
      roleRecord: compactRecord({
        profile_id: input.profileId || null,
        school_id: input.schoolId,
        employee_number: normalizeOptionalString(input.form.employee_id),
        department: normalizeOptionalString(input.form.department),
        specialization: normalizeOptionalString(input.form.specialization),
        hire_date: normalizeOptionalString(input.form.hire_date),
        is_active: toActiveFlag(input.form.status),
      }),
      parentRecord: null,
    };
  }

  return {
    profile,
    roleRecord: null,
    parentRecord: compactRecord({
      profile_id: input.profileId || null,
      school_id: input.schoolId,
      relation_type: normalizeOptionalString(input.form.relation_type),
      occupation: normalizeOptionalString(input.form.occupation),
      phone: normalizeOptionalString(input.form.phone),
    }),
  };
}

export function normalizeOptionalString(value: unknown) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function compactRecord(record: Record<string, any>) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function getDisplayName(profile: any): string {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.name ||
    profile?.email ||
    "User"
  );
}
