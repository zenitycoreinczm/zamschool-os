export const KNOWN_ROLES = [
  "TEACHER",
  "STUDENT",
  "PARENT",
  "PAYMENTS",
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "BURSAR",
  "GUIDANCE_OFFICE",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "SUPER_ADMIN",
] as const;

export type KnownRole = (typeof KNOWN_ROLES)[number];

/**
 * Canonical school leadership:
 * - PRINCIPAL = Head Teacher (school owner; created at registration)
 * - DEPUTY_HEAD = Deputy Head Teacher
 * - SUPER_ADMIN = platform operator (not a school job title)
 *
 * Staff specialties: teacher, bursar, registrar, ict_admin, etc.
 *
 * Legacy "admin" / "School Administrator" is collapsed into Head Teacher so
 * we do not keep two near-duplicate school-owner roles.
 */
const ROLE_ALIASES: Record<string, KnownRole> = {
  // Legacy school administrator → Head Teacher
  ADMIN: "PRINCIPAL",
  ADMINISTRATOR: "PRINCIPAL",
  SCHOOL_ADMINISTRATOR: "PRINCIPAL",
  // Head Teacher aliases
  HEAD_TEACHER: "PRINCIPAL",
  HEADTEACHER: "PRINCIPAL",
  PRINCIPAL: "PRINCIPAL",
  // Deputy
  DEPUTY_HEAD_TEACHER: "DEPUTY_HEAD",
  DEPUTY_HEADTEACHER: "DEPUTY_HEAD",
  DEPUTY_HEAD: "DEPUTY_HEAD",
  // Finance
  FINANCE_OFFICER: "BURSAR",
  FINANCE: "BURSAR",
  // Guidance
  GUIDANCE_OFFICER: "GUIDANCE_OFFICE",
  GUIDANCE: "GUIDANCE_OFFICE",
  // ICT
  IT_ADMIN: "ICT_ADMIN",
  IT_ADMINISTRATOR: "ICT_ADMIN",
  ICT_ADMINISTRATOR: "ICT_ADMIN",
  // Admissions
  ADMISSIONS_OFFICER: "REGISTRAR",
  ADMISSIONS: "REGISTRAR",
  SCHOOL_SECRETARY: "REGISTRAR",
  REGISTRAR: "REGISTRAR",
};

const STORED_ROLE_VALUES: Record<KnownRole, string> = {
  TEACHER: "teacher",
  STUDENT: "student",
  PARENT: "parent",
  PAYMENTS: "payments",
  PRINCIPAL: "principal",
  DEPUTY_HEAD: "deputy_head",
  BURSAR: "bursar",
  GUIDANCE_OFFICE: "guidance_office",
  ACADEMIC_ADMIN: "academic_admin",
  HR_ADMIN: "hr_admin",
  ICT_ADMIN: "ict_admin",
  DISCIPLINE_ADMIN: "discipline_admin",
  REGISTRAR: "registrar",
  SUPER_ADMIN: "super_admin",
};

export function normalizeRole(
  role: string | null | undefined,
): KnownRole | null {
  const normalized = String(role || "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  if (!normalized) return null;
  if (KNOWN_ROLES.includes(normalized as KnownRole))
    return normalized as KnownRole;
  return ROLE_ALIASES[normalized] || null;
}

export function roleToStoredValue(
  role: string | null | undefined,
): string | null {
  const normalized = normalizeRole(role);
  return normalized ? STORED_ROLE_VALUES[normalized] : null;
}

export function roleDatabaseValues(role: string | null | undefined): string[] {
  const normalized = normalizeRole(role);
  if (!normalized) return [];

  const stored = STORED_ROLE_VALUES[normalized];
  const values = new Set<string>([
    stored,
    normalized,
    normalized.toLowerCase(),
  ]);

  for (const [alias, canonical] of Object.entries(ROLE_ALIASES)) {
    if (canonical === normalized) {
      values.add(alias);
      values.add(alias.toLowerCase());
    }
  }

  // Legacy profile rows may still store "admin" for Head Teacher.
  if (normalized === "PRINCIPAL") {
    values.add("admin");
    values.add("ADMIN");
    values.add("administrator");
  }

  return Array.from(values);
}

/** School leadership + specialty office roles that use admin-style tools. */
export function isAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return Boolean(
    normalized &&
      [
        "PRINCIPAL",
        "SUPER_ADMIN",
        "DEPUTY_HEAD",
        "ACADEMIC_ADMIN",
        "HR_ADMIN",
        "ICT_ADMIN",
        "REGISTRAR",
        "DISCIPLINE_ADMIN",
        "GUIDANCE_OFFICE",
        "BURSAR",
      ].includes(normalized),
  );
}

export function isSensitiveRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return Boolean(
    normalized &&
      ["SUPER_ADMIN", "PRINCIPAL", "BURSAR", "ICT_ADMIN"].includes(normalized),
  );
}

export function isFinancialRole(role: string | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return Boolean(normalized && ["BURSAR", "PAYMENTS"].includes(normalized));
}

/** Human-readable labels (Zambia school terminology). */
export const ROLE_DISPLAY_LABELS: Record<string, string> = {
  // Legacy key still maps to Head Teacher for old UI/DB strings
  admin: "Head Teacher",
  principal: "Head Teacher",
  deputy_head: "Deputy Head Teacher",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent / Guardian",
  payments: "Payments Officer",
  bursar: "Bursar",
  guidance_office: "Guidance Office",
  academic_admin: "Academic admin",
  hr_admin: "HR admin",
  ict_admin: "ICT admin",
  discipline_admin: "Discipline admin",
  registrar: "Registrar / Admissions",
  super_admin: "Platform Super Admin",
};

export function getRoleDisplayLabel(role: string | null | undefined): string {
  const stored = roleToStoredValue(role);
  if (stored && ROLE_DISPLAY_LABELS[stored]) return ROLE_DISPLAY_LABELS[stored];

  const raw = String(role || "")
    .trim()
    .toLowerCase();
  if (raw && ROLE_DISPLAY_LABELS[raw]) return ROLE_DISPLAY_LABELS[raw];

  const normalized = normalizeRole(role);
  if (normalized) {
    const fromCanonical = roleToStoredValue(normalized);
    if (fromCanonical && ROLE_DISPLAY_LABELS[fromCanonical]) {
      return ROLE_DISPLAY_LABELS[fromCanonical];
    }
  }

  if (!raw) return "Account";
  return raw
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isPrincipalRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "PRINCIPAL";
}

/**
 * @deprecated School Administrator was removed as a separate role.
 * Legacy admin profiles normalize to Head Teacher (principal).
 */
export function isSchoolAdministratorRole(
  role: string | null | undefined,
): boolean {
  return false;
}

export function isPlatformSuperAdminRole(
  role: string | null | undefined,
): boolean {
  return normalizeRole(role) === "SUPER_ADMIN";
}

/** Leadership roles at a school (not platform super admin, not specialty staff). */
export function isSchoolLeadershipRole(
  role: string | null | undefined,
): boolean {
  const normalized = normalizeRole(role);
  return normalized === "PRINCIPAL" || normalized === "DEPUTY_HEAD";
}
