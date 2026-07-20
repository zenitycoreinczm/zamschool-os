import { GraduationCap, Users, UsersRound } from "lucide-react";

export type TabKey = "students" | "teachers" | "parents";
export type ManagedAccountRole = "student" | "teacher" | "parent";

/** Directory list row from `/api/admin/users` (student / teacher / parent). */
export type DirectoryUser = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  status?: string | null;
  role?: string | null;
  admission_number?: string | null;
  class_number?: number | null;
  class_id?: string | null;
  class_name?: string | null;
  class?: string | null;
  enrollment_date?: string | null;
  enrolled_at?: string | null;
  employee_id?: string | null;
  employee_number?: string | null;
  department?: string | null;
  specialization?: string | null;
  hire_date?: string | null;
  hired_at?: string | null;
  occupation?: string | null;
  relation_type?: string | null;
};

/** Parent metadata keyed by profile id (relation, occupation, …). */
export type ParentMeta = {
  profile_id?: string;
  relation_type?: string | null;
  occupation?: string | null;
  [key: string]: any;
};

/**
 * User detail API payload. Shape varies by role; the dashboard reads nested
 * fields (attendance, results, linked children, etc.). Open index keeps the
 * detail dashboard flexible without `any` on directory list rows.
 */
export type UserDetailData = DirectoryUser & {
  displayName?: string;
  specializationSubjectIds?: string[];
  teachingAssignments?: Array<{ classId?: string; subjectId?: string }>;
  supervisedClassIds?: string[];
  // Nested role-specific payloads (attendance, fees, inbox, …).
  [key: string]: any;
};

/** Prefer DirectoryUser for list rows; UserDetailData for detail payloads. */
export type GenericRow = UserDetailData;

export type UserForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  admission_number: string;
  class_id: string;
  enrollment_date: string;
  employee_id: string;
  department: string;
  specialization: string;
  hire_date: string;
  relation_type: string;
  occupation: string;
  specialization_subject_ids: string[];
  teaching_assignments: TeacherAssignmentDraft[];
  supervised_class_ids: string[];
};

export type ParentLinkTarget = { id: string; name: string; admission?: string };
export type ClassOption = { id: string; label: string };
export type SubjectOption = { id: string; label: string };

export type TeacherAssignmentDraft = {
  id: string;
  classId: string;
  subjectId: string;
};

export type TeacherInlineSubjectSection = "specializations" | "assignments" | null;
export type TeacherInlineClassSection = "assignments" | "supervised" | null;

export type FormNotice = {
  tone: "error" | "info";
  message: string;
};

export type NewCredentials = {
  email: string;
  password: string;
  emailSent?: boolean;
};

export const PAGE_SIZE = 10;

export const TABS: Array<{ key: TabKey; label: string; icon: typeof GraduationCap }> = [
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "teachers", label: "Teachers", icon: Users },
  { key: "parents", label: "Parents", icon: UsersRound },
];

export const MANAGED_ACCOUNT_ROLES = new Set(["student", "teacher", "parent"]);

export const EMPTY_FORM: UserForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  status: "ACTIVE",
  admission_number: "",
  class_id: "",
  enrollment_date: "",
  employee_id: "",
  department: "",
  specialization: "",
  hire_date: "",
  relation_type: "Mother",
  occupation: "",
  specialization_subject_ids: [],
  teaching_assignments: [],
  supervised_class_ids: [],
};

/** Roles that should not use the people directory console (redirect home). */
export const ADMIN_SUBTYPE_ROLE_DASHBOARDS: Record<string, string> = {
  // Head Teacher manages access via Invite staff - not the people directory.
  PRINCIPAL: "/app/principal/staff",
  DEPUTY_HEAD: "/app/deputy-head",
  BURSAR: "/app/bursar",
  GUIDANCE_OFFICE: "/app/guidance",
  ACADEMIC_ADMIN: "/app/academic-admin",
  HR_ADMIN: "/app/hr-admin/directory",
  ICT_ADMIN: "/app/ict-admin/recovery",
  DISCIPLINE_ADMIN: "/app/discipline-admin",
  REGISTRAR: "/app/registrar/people",
};

export function adminSubtypeHomePath(role: string): string | null {
  return ADMIN_SUBTYPE_ROLE_DASHBOARDS[role] ?? null;
}

/** Canonical role strings (same values as KnownRole in lib/roles). */
export const USERS_CONSOLE_ALLOWED_ROLES = new Set<string>([
  // Head Teacher uses Invite staff - not this directory.
  "SUPER_ADMIN",
  "REGISTRAR",
  "ICT_ADMIN",
  // HR owns staff records - must open the directory (not bounce to HR hub).
  "HR_ADMIN",
]);

export const USERS_RECOVERY_ROLES = new Set<string>(["ICT_ADMIN"]);

/** Roles that land on the Teachers tab by default (staff-focused directories). */
export const USERS_CONSOLE_DEFAULT_TEACHERS_TAB = new Set<string>([
  "HR_ADMIN",
  "ICT_ADMIN",
]);
