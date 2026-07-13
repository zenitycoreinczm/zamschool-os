import type { KnownRole } from "@/lib/roles";

/** Roles that may read/update their own profile and upload an avatar (school-scoped). */
export const ACCOUNT_PROFILE_ROLES = [
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "BURSAR",
  "PAYMENTS",
  "GUIDANCE_OFFICE",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "SUPER_ADMIN",
] as const satisfies readonly KnownRole[];
