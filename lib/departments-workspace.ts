import { getDisplayName } from "@/lib/profile-utils";
import { normalizeRole } from "@/lib/roles";

export type DepartmentHeadSummary = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  label: string;
};

export type DepartmentStaffOption = {
  id: string;
  label: string;
  role: string;
  roleLabel: string;
  department?: string | null;
  isTeacher: boolean;
};

export type EnrichedDepartment = {
  id: string;
  name: string;
  description?: string | null;
  head_of_department?: string | null;
  is_default?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  head: DepartmentHeadSummary | null;
  member_count: number;
};

export type DepartmentsWorkspacePayload = {
  departments: EnrichedDepartment[];
  staffOptions: DepartmentStaffOption[];
  stats: {
    total: number;
    withHead: number;
    withoutHead: number;
    membersLinked: number;
    staffEligible: number;
  };
};

const EXCLUDED_HEAD_ROLES = new Set([
  "student",
  "parent",
  "payments",
  "super_admin",
]);

export function isEligibleDepartmentHeadRole(
  role: string | null | undefined,
): boolean {
  const stored = String(role || "")
    .trim()
    .toLowerCase();
  if (!stored) return false;
  if (EXCLUDED_HEAD_ROLES.has(stored)) return false;
  const canonical = normalizeRole(role);
  if (!canonical) return false;
  if (
    canonical === "STUDENT" ||
    canonical === "PARENT" ||
    canonical === "PAYMENTS" ||
    canonical === "SUPER_ADMIN"
  ) {
    return false;
  }
  return true;
}

export function formatDepartmentHeadLabel(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  id?: string;
}): string {
  const name = getDisplayName(input);
  if (name && name !== "User" && name !== "Unknown") return name;
  if (input.email) return String(input.email);
  return input.id ? `Staff ${String(input.id).slice(0, 8)}` : "Staff";
}

export function roleDisplayLabel(role: string | null | undefined): string {
  const canonical = normalizeRole(role);
  switch (canonical) {
    case "TEACHER":
      return "Teacher";
    case "PRINCIPAL":
      return "Head Teacher";
    case "DEPUTY_HEAD":
      return "Deputy Head";
    case "BURSAR":
      return "Bursar";
    case "GUIDANCE_OFFICE":
      return "Guidance";
    case "ACADEMIC_ADMIN":
      return "Academic admin";
    case "HR_ADMIN":
      return "HR admin";
    case "ICT_ADMIN":
      return "ICT admin";
    case "DISCIPLINE_ADMIN":
      return "Discipline";
    case "REGISTRAR":
      return "Registrar";
    default:
      return String(role || "Staff")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Case-insensitive department name → teacher/profile count. */
export function countMembersByDepartmentName(
  departmentNames: string[],
  staffDepartments: Array<string | null | undefined>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of departmentNames) {
    counts.set(normalizeDeptKey(name), 0);
  }
  for (const raw of staffDepartments) {
    const key = normalizeDeptKey(raw);
    if (!key || !counts.has(key)) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function normalizeDeptKey(value: string | null | undefined): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function enrichDepartments(input: {
  departments: Array<{
    id: string;
    name: string;
    description?: string | null;
    head_of_department?: string | null;
    is_default?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>;
  headById: Map<string, DepartmentHeadSummary>;
  memberCounts: Map<string, number>;
}): EnrichedDepartment[] {
  return input.departments.map((dept) => {
    const headId = dept.head_of_department
      ? String(dept.head_of_department)
      : "";
    const head = headId ? input.headById.get(headId) || null : null;
    const member_count =
      input.memberCounts.get(normalizeDeptKey(dept.name)) || 0;
    return {
      ...dept,
      head,
      member_count,
    };
  });
}

export function buildDepartmentsStats(
  departments: EnrichedDepartment[],
  staffEligible: number,
) {
  const withHead = departments.filter((d) => Boolean(d.head_of_department)).length;
  const membersLinked = departments.reduce((sum, d) => sum + d.member_count, 0);
  return {
    total: departments.length,
    withHead,
    withoutHead: departments.length - withHead,
    membersLinked,
    staffEligible,
  };
}
