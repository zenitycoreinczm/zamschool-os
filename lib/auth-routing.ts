import { normalizeRole } from "./roles.ts";
import { isSafeInternalPath } from "./request-security.ts";

export const TEACHER_DASHBOARD_PATH = "/app/teacher";
export const PAYMENTS_DASHBOARD_PATH = "/app/payments";
export const PRINCIPAL_DASHBOARD_PATH = "/app/principal";
export const DEPUTY_HEAD_DASHBOARD_PATH = "/app/deputy-head";
export const BURSAR_DASHBOARD_PATH = "/app/bursar";
export const GUIDANCE_OFFICE_DASHBOARD_PATH = "/app/guidance";
export const ACADEMIC_ADMIN_DASHBOARD_PATH = "/app/academic-admin";
export const HR_ADMIN_DASHBOARD_PATH = "/app/hr-admin";
export const ICT_ADMIN_DASHBOARD_PATH = "/app/ict-admin";
export const DISCIPLINE_ADMIN_DASHBOARD_PATH = "/app/discipline-admin";
export const REGISTRAR_DASHBOARD_PATH = "/app/registrar";
export const SUPER_ADMIN_DASHBOARD_PATH = "/app/super-admin";
export const ADMIN_DASHBOARD_PATH = "/app/dashboard";
export const STUDENT_DASHBOARD_PATH = "/app/student";
export const PARENT_DASHBOARD_PATH = "/app/parent";

const LEGACY_PROTECTED_PREFIX_REDIRECTS = [
  ["/payments", PAYMENTS_DASHBOARD_PATH],
  ["/dashboard", "/app/dashboard"],
  ["/account", "/app/profile"],
  ["/profile", "/app/profile"],
  ["/settings", "/app/settings"],
] as const;

export function isSharedProtectedPath(pathname: string): boolean {
  const sharedProtectedPrefixes = [
    "/app/profile",
    "/app/settings",
    "/app/messages",
    "/app/announcements",
    "/app/events",
    "/app/notifications",
  ];
  return sharedProtectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function roleToPath(role: string | null | undefined) {
  const normalized = normalizeRole(role) || "TEACHER";
  // Legacy admin normalizes to PRINCIPAL → Head Teacher home.
  if (normalized === "TEACHER") return TEACHER_DASHBOARD_PATH;
  if (normalized === "STUDENT") return STUDENT_DASHBOARD_PATH;
  if (normalized === "PARENT") return PARENT_DASHBOARD_PATH;
  if (normalized === "PAYMENTS") return PAYMENTS_DASHBOARD_PATH;
  if (normalized === "PRINCIPAL") return PRINCIPAL_DASHBOARD_PATH;
  if (normalized === "DEPUTY_HEAD") return DEPUTY_HEAD_DASHBOARD_PATH;
  if (normalized === "BURSAR") return BURSAR_DASHBOARD_PATH;
  if (normalized === "GUIDANCE_OFFICE") return GUIDANCE_OFFICE_DASHBOARD_PATH;
  if (normalized === "ACADEMIC_ADMIN") return ACADEMIC_ADMIN_DASHBOARD_PATH;
  if (normalized === "HR_ADMIN") return HR_ADMIN_DASHBOARD_PATH;
  if (normalized === "ICT_ADMIN") return ICT_ADMIN_DASHBOARD_PATH;
  if (normalized === "DISCIPLINE_ADMIN") return DISCIPLINE_ADMIN_DASHBOARD_PATH;
  if (normalized === "REGISTRAR") return REGISTRAR_DASHBOARD_PATH;
  if (normalized === "SUPER_ADMIN") return SUPER_ADMIN_DASHBOARD_PATH;
  return PRINCIPAL_DASHBOARD_PATH;
}

/** Relative same-app redirects only (blocks //evil.com open redirects). */
function isSafeRedirect(
  redirectTo: string | null | undefined,
): redirectTo is string {
  return isSafeInternalPath(redirectTo);
}

/** Public alias for post-login / query redirect validation. */
export { isSafeInternalPath as isSafeRedirectPath };

function mapTeacherSharedPath(pathname: string): string {
  if (pathname === "/app/profile") return "/app/teacher/profile";
  if (pathname.startsWith("/app/profile/")) {
    return pathname.replace("/app/profile", "/app/teacher/profile");
  }
  if (pathname === "/app/settings") return "/app/teacher/settings";
  if (pathname.startsWith("/app/settings/")) {
    return pathname.replace("/app/settings", "/app/teacher/settings");
  }
  return pathname;
}

function mapStudentSharedPath(pathname: string): string {
  if (pathname === "/app/profile") return "/app/student/profile";
  if (pathname.startsWith("/app/profile/")) {
    return pathname.replace("/app/profile", "/app/student/profile");
  }
  if (pathname === "/app/settings") return "/app/student/settings";
  if (pathname.startsWith("/app/settings/")) {
    return pathname.replace("/app/settings", "/app/student/settings");
  }
  if (pathname === "/app/messages") return "/app/student/messages";
  if (pathname === "/app/notifications") return "/app/student/notifications";
  if (pathname === "/app/announcements") return "/app/student/announcements";
  return pathname;
}

function mapParentSharedPath(pathname: string): string {
  if (pathname === "/app/profile") return "/app/parent/profile";
  if (pathname.startsWith("/app/profile/")) {
    return pathname.replace("/app/profile", "/app/parent/profile");
  }
  if (pathname === "/app/settings") return "/app/parent/settings";
  if (pathname.startsWith("/app/settings/")) {
    return pathname.replace("/app/settings", "/app/parent/settings");
  }
  if (pathname === "/app/messages") return "/app/parent/messages";
  if (pathname === "/app/notifications") return "/app/parent/notifications";
  if (pathname === "/app/announcements") return "/app/parent/announcements";
  return pathname;
}

export function normalizeLegacyDashboardPath(pathname: string): string {
  for (const [
    legacyPrefix,
    canonicalPrefix,
  ] of LEGACY_PROTECTED_PREFIX_REDIRECTS) {
    if (pathname === legacyPrefix) return canonicalPrefix;
    if (pathname.startsWith(`${legacyPrefix}/`)) {
      return pathname.replace(legacyPrefix, canonicalPrefix);
    }
  }
  return pathname;
}

export function resolveRoleAwareProtectedPath(
  role: string | null | undefined,
  pathname: string,
): string {
  const normalized = normalizeRole(role);
  if (normalized === "TEACHER") {
    if (pathname === "/app/teacher") return TEACHER_DASHBOARD_PATH;
    if (pathname.startsWith("/app/teacher/")) {
      return pathname.replace("/app/teacher", TEACHER_DASHBOARD_PATH);
    }
    return mapTeacherSharedPath(pathname);
  }
  if (normalized === "STUDENT") {
    return mapStudentSharedPath(pathname);
  }
  if (normalized === "PARENT") {
    return mapParentSharedPath(pathname);
  }
  return pathname;
}

export function resolveProtectedRolePrefix(
  role: string | null | undefined,
): string {
  const normalized = normalizeRole(role);
  if (!normalized) return "";
  if (normalized === "TEACHER") return "/app/teacher";
  if (normalized === "STUDENT") return "/app/student";
  if (normalized === "PARENT") return "/app/parent";
  if (normalized === "PAYMENTS") return "/app/payments";
  if (normalized === "PRINCIPAL") return "/app/principal";
  if (normalized === "DEPUTY_HEAD") return "/app/deputy-head";
  if (normalized === "BURSAR") return "/app/bursar";
  if (normalized === "GUIDANCE_OFFICE") return "/app/guidance";
  if (normalized === "ACADEMIC_ADMIN") return "/app/academic-admin";
  if (normalized === "HR_ADMIN") return "/app/hr-admin";
  if (normalized === "ICT_ADMIN") return "/app/ict-admin";
  if (normalized === "DISCIPLINE_ADMIN") return "/app/discipline-admin";
  if (normalized === "REGISTRAR") return "/app/registrar";
  if (normalized === "SUPER_ADMIN") return "/app/super-admin";
  return "/app/principal";
}

export function resolvePostLoginPath(
  role: string | null | undefined,
  redirectTo?: string | null,
): string {
  const normalized = normalizeRole(role);
  if (!normalized) return "/login?error=profile_not_found";

  const fallbackPath = roleToPath(normalized);
  if (!isSafeRedirect(redirectTo)) return fallbackPath;

  const normalizedRedirect = resolveRoleAwareProtectedPath(
    normalized,
    normalizeLegacyDashboardPath(redirectTo),
  );
  if (isSharedProtectedPath(normalizedRedirect)) return normalizedRedirect;

  if (normalized === "PRINCIPAL") {
    // Old School Administrator home (/app/dashboard) → Head Teacher home.
    if (normalizedRedirect === ADMIN_DASHBOARD_PATH) {
      return PRINCIPAL_DASHBOARD_PATH;
    }
    if (
      normalizedRedirect === PRINCIPAL_DASHBOARD_PATH ||
      normalizedRedirect.startsWith(`${PRINCIPAL_DASHBOARD_PATH}/`) ||
      normalizedRedirect.startsWith("/app/admin")
    ) {
      return normalizedRedirect;
    }
    return fallbackPath;
  }

  const protectedPrefix = resolveProtectedRolePrefix(normalized);
  if (
    protectedPrefix &&
    (normalizedRedirect === protectedPrefix ||
      normalizedRedirect.startsWith(`${protectedPrefix}/`))
  ) {
    return normalizedRedirect;
  }

  return fallbackPath;
}

export function resolvePostRegistrationPath(
  role: string | null | undefined,
): string {
  return resolvePostLoginPath(role);
}

export function resolveOnboardingPath({
  role,
  emailVerified,
  hasSchool,
  mustChangePassword,
  redirectTo,
}: {
  role: string | null | undefined;
  emailVerified: boolean;
  hasSchool: boolean;
  mustChangePassword?: boolean;
  redirectTo?: string | null;
}): string {
  const normalized = normalizeRole(role);

  if (!emailVerified) return "/verify-email";
  if (mustChangePassword) return "/first-login";
  if (normalized === "PRINCIPAL" && !hasSchool) return "/app/admin/school";

  return resolvePostLoginPath(normalized, redirectTo);
}

/**
 * Route a user whose auth row exists but profile/school setup is incomplete.
 * Without this, verified users land on /login?error=profile_not_found with
 * no path to finish registration. Head Teachers resume school registration.
 */
export function resolveMissingProfilePath({
  role,
  hasSchool,
  emailVerified,
}: {
  role: string | null | undefined;
  hasSchool: boolean;
  emailVerified: boolean;
}): string {
  if (!emailVerified) return "/verify-email";
  const normalized = normalizeRole(role);
  if ((normalized === "PRINCIPAL" || !normalized) && !hasSchool) {
    return "/register?resume=school";
  }
  return "/login?error=profile_not_found";
}

export function resolveAppWorkspaceHome(
  role: string | null | undefined,
): string {
  const normalized = normalizeRole(role);
  if (normalized === "TEACHER") return TEACHER_DASHBOARD_PATH;
  if (normalized === "STUDENT") return STUDENT_DASHBOARD_PATH;
  if (normalized === "PARENT") return PARENT_DASHBOARD_PATH;
  if (normalized === "PAYMENTS") return PAYMENTS_DASHBOARD_PATH;
  if (normalized === "PRINCIPAL") return PRINCIPAL_DASHBOARD_PATH;
  if (normalized === "DEPUTY_HEAD") return DEPUTY_HEAD_DASHBOARD_PATH;
  if (normalized === "BURSAR") return BURSAR_DASHBOARD_PATH;
  if (normalized === "GUIDANCE_OFFICE") return GUIDANCE_OFFICE_DASHBOARD_PATH;
  if (normalized === "ACADEMIC_ADMIN") return ACADEMIC_ADMIN_DASHBOARD_PATH;
  if (normalized === "HR_ADMIN") return HR_ADMIN_DASHBOARD_PATH;
  if (normalized === "ICT_ADMIN") return ICT_ADMIN_DASHBOARD_PATH;
  if (normalized === "DISCIPLINE_ADMIN") return DISCIPLINE_ADMIN_DASHBOARD_PATH;
  if (normalized === "REGISTRAR") return REGISTRAR_DASHBOARD_PATH;
  if (normalized === "SUPER_ADMIN") return SUPER_ADMIN_DASHBOARD_PATH;
  return PRINCIPAL_DASHBOARD_PATH;
}
