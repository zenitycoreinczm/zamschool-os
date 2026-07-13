import { resolveAppWorkspaceHome } from "./auth-routing.ts";
import {
  normalizeRole as normalizeKnownRole,
  roleToStoredValue,
} from "./roles.ts";

export type MenuRole = "admin" | "principal" | "teacher" | "student" | "parent";

/**
 * Legacy sidebar role bucket. Head Teacher maps to `principal`, not `admin`.
 */
export function normalizeRole(
  role: string | null | undefined,
): MenuRole | null {
  const canonical = normalizeKnownRole(role);
  if (!canonical) {
    return null;
  }

  if (canonical === "PRINCIPAL") {
    return "principal";
  }

  if (canonical === "SUPER_ADMIN") {
    return "admin";
  }

  if (canonical === "TEACHER") {
    return "teacher";
  }

  if (canonical === "STUDENT") {
    return "student";
  }

  if (canonical === "PARENT") {
    return "parent";
  }

  const stored = roleToStoredValue(canonical);
  if (stored === "principal") return "principal";
  if (stored === "admin" || stored === "super_admin") return "admin";
  if (stored === "teacher") return "teacher";
  if (stored === "student") return "student";
  if (stored === "parent") return "parent";

  return null;
}

export function roleToPath(role: string | null | undefined): string {
  const stored = roleToStoredValue(role);
  if (stored === "teacher") return "/app/teacher";
  if (stored === "student") return "/app/student";
  if (stored === "parent") return "/app/parent";
  return resolveAppWorkspaceHome(role);
}

export function getDisplayName(profile: any): string {
  return (
    [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    profile?.name ||
    profile?.email ||
    "User"
  );
}
