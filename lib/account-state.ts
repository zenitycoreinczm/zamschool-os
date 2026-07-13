import { scryptSync, randomBytes } from "node:crypto";

export const MANAGED_FIRST_LOGIN_ROLES = [
  "admin",
  "teacher",
  "student",
  "parent",
  "payments",
  "bursar",
  "deputy_head",
  "guidance_office",
  "academic_admin",
  "hr_admin",
  "ict_admin",
  "discipline_admin",
  "registrar",
] as const;

export function shouldRequireFirstLoginPasswordChange(role: string) {
  return MANAGED_FIRST_LOGIN_ROLES.includes(
    role as (typeof MANAGED_FIRST_LOGIN_ROLES)[number],
  );
}

export function buildCreatedAuthUserMetadata(input: {
  firstName: string;
  lastName: string;
  role: string;
}) {
  return {
    first_name: input.firstName,
    last_name: input.lastName,
    role: input.role,
    must_change_password: shouldRequireFirstLoginPasswordChange(input.role),
  };
}

export function generateTemporaryPassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const random = Array.from(
    bytes,
    (byte) => alphabet[byte % alphabet.length],
  ).join("");
  return `Zam@${random}9`;
}

export function hashTemporaryPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

/**
 * Role-table fields that may ride along in profileExtras for teacher/student
 * inserts, but must never be written to `public.profiles` (PostgREST PGRST204
 * if they are — e.g. hire_date lives only on teachers).
 */
const PROFILE_EXTRAS_ROLE_TABLE_ONLY = new Set(["hire_date"]);

export function buildCreatedProfilePayload(input: {
  authUserId: string;
  schoolId: string;
  role: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileExtras: Record<string, any>;
  now?: Date;
}) {
  const now = input.now || new Date();
  const requiresPasswordChange = shouldRequireFirstLoginPasswordChange(
    input.role,
  );

  const profileSafeExtras = Object.fromEntries(
    Object.entries(input.profileExtras || {}).filter(
      ([key]) => !PROFILE_EXTRAS_ROLE_TABLE_ONLY.has(key),
    ),
  );

  return {
    id: input.authUserId,
    school_id: input.schoolId,
    role: input.role.toLowerCase(),
    name: `${input.firstName} ${input.lastName}`.trim(),
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    must_change_password: requiresPasswordChange,
    temporary_password_issued_at: requiresPasswordChange
      ? now.toISOString()
      : null,
    ...profileSafeExtras,
  };
}
