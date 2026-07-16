/**
 * Core routes and APIs that should remain useful when school networks drop
 * (common on shared LAN / mobile data in Zambian schools).
 *
 * Keep this list tight - over-caching sensitive write surfaces is harmful.
 * Warmup is role- and school-aware: platform super_admin must never fan out
 * into school-scoped APIs (those return 403 and thrash compile + Supabase).
 */

export const OFFLINE_CORE_PAGE_URLS = [
  // Leadership & admin (legacy /app/admin/users retired)
  "/app/principal",
  "/app/principal/staff",
  "/app/hr-admin/directory",
  "/app/ict-admin/recovery",
  "/app/registrar/people",
  "/app/admin/fees",
  "/app/admin/finance",
  "/app/admin/classes",
  "/app/announcements",
  // Teaching
  "/app/teacher",
  "/app/teacher/attendance",
  "/app/teacher/classes",
  "/app/teacher/students",
  // Family & learners
  "/app/parent",
  "/app/parent/attendance",
  "/app/parent/children",
  "/app/student",
  "/app/student/results",
  // Finance desk
  "/app/payments",
  "/app/payments/fees",
] as const;

export const OFFLINE_CORE_API_URLS = [
  "/api/admin/users",
  "/api/admin/classes",
  "/api/admin/subjects",
  "/api/admin/finance",
  "/api/admin/payments",
  "/api/admin/announcements",
  "/api/account/shell",
  "/api/account/workspace-context",
  "/api/workspace/summary",
  "/api/dashboard/summary",
  "/api/teacher/bootstrap",
  "/api/payments/billing/summary",
] as const;

/** Shared account surfaces safe for any authenticated role with a school. */
const SCHOOL_SHARED_APIS = [
  "/api/account/workspace-context",
  "/api/account/shell",
  "/api/workspace/summary",
] as const;

const SCHOOL_ADMIN_APIS = [
  "/api/admin/users",
  "/api/admin/classes",
  "/api/admin/subjects",
  "/api/admin/finance",
  "/api/admin/payments",
  "/api/admin/announcements",
  "/api/dashboard/summary",
] as const;

const TEACHER_APIS = [
  "/api/teacher/bootstrap",
  "/api/admin/announcements",
] as const;

const PAYMENTS_APIS = [
  "/api/payments/billing/summary",
  "/api/admin/payments",
  "/api/admin/finance",
] as const;

const SCHOOL_ADMIN_PAGES = [
  "/app/principal",
  "/app/principal/staff",
  "/app/hr-admin/directory",
  "/app/ict-admin/recovery",
  "/app/registrar/people",
  "/app/admin/fees",
  "/app/admin/finance",
  "/app/admin/classes",
  "/app/announcements",
] as const;

const TEACHER_PAGES = [
  "/app/teacher",
  "/app/teacher/attendance",
  "/app/teacher/classes",
  "/app/teacher/students",
  "/app/announcements",
] as const;

const PARENT_PAGES = [
  "/app/parent",
  "/app/parent/attendance",
  "/app/parent/children",
] as const;

const STUDENT_PAGES = ["/app/student", "/app/student/results"] as const;

const PAYMENTS_PAGES = ["/app/payments", "/app/payments/fees"] as const;

/** Latency (ms) above which the UI shows “Network is slow”. Tuned for mobile data. */
export const SLOW_NETWORK_THRESHOLD_MS = 2200;

export const OFFLINE_FETCH_ERROR_MESSAGE =
  "You appear offline. Changes can’t be saved until the connection returns.";

export function isOfflineCorePagePath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);
  return OFFLINE_CORE_PAGE_URLS.includes(
    normalizedPath as (typeof OFFLINE_CORE_PAGE_URLS)[number],
  );
}

export function isOfflineCoreApiPath(pathname: string) {
  const normalizedPath = normalizePathname(pathname);
  return OFFLINE_CORE_API_URLS.includes(
    normalizedPath as (typeof OFFLINE_CORE_API_URLS)[number],
  );
}

export function normalizePathname(pathname: string) {
  return String(pathname || "").split("?")[0] || "/";
}

export function isSlowNetworkLatency(latencyMs: number) {
  return Number(latencyMs) >= SLOW_NETWORK_THRESHOLD_MS;
}

function roleKey(role: string | null | undefined) {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * APIs to prefetch into the offline cache for the current actor.
 * Empty for platform super_admin (no school) and incomplete profiles.
 */
export function resolveOfflineWarmupApis(params: {
  role?: string | null;
  schoolId?: string | null;
}): string[] {
  const role = roleKey(params.role);
  const schoolId = String(params.schoolId || "").trim();

  // Platform operator: never hit school-scoped routes.
  if (role === "super_admin" && !schoolId) {
    return [];
  }

  // No tenant yet (onboarding / broken link) - warming only produces 403 storms.
  if (!schoolId) {
    return [];
  }

  const apis = new Set<string>(SCHOOL_SHARED_APIS);

  if (
    [
      "principal",
      "admin",
      "deputy_head",
      "bursar",
      "academic_admin",
      "hr_admin",
      "ict_admin",
      "discipline_admin",
      "guidance_office",
      "registrar",
    ].includes(role)
  ) {
    for (const path of SCHOOL_ADMIN_APIS) apis.add(path);
  }

  if (role === "teacher") {
    for (const path of TEACHER_APIS) apis.add(path);
  }

  if (role === "payments" || role === "bursar") {
    for (const path of PAYMENTS_APIS) apis.add(path);
  }

  // Super admin with an explicit school link (rare) - admin pack only.
  if (role === "super_admin") {
    for (const path of SCHOOL_ADMIN_APIS) apis.add(path);
  }

  return Array.from(apis);
}

/**
 * App routes to soft-prefetch for offline navigation.
 * Keep this small - each path can force a multi-second Next compile in dev.
 */
export function resolveOfflineWarmupPages(params: {
  role?: string | null;
  schoolId?: string | null;
}): string[] {
  const role = roleKey(params.role);
  const schoolId = String(params.schoolId || "").trim();

  if (role === "super_admin" && !schoolId) {
    return ["/app/super-admin"];
  }

  if (!schoolId) {
    return [];
  }

  if (
    [
      "principal",
      "admin",
      "deputy_head",
      "academic_admin",
      "hr_admin",
      "ict_admin",
      "discipline_admin",
      "guidance_office",
      "registrar",
    ].includes(role)
  ) {
    return [...SCHOOL_ADMIN_PAGES];
  }

  if (role === "bursar" || role === "payments") {
    return [...PAYMENTS_PAGES, "/app/announcements"];
  }

  if (role === "teacher") {
    return [...TEACHER_PAGES];
  }

  if (role === "parent") {
    return [...PARENT_PAGES];
  }

  if (role === "student") {
    return [...STUDENT_PAGES];
  }

  if (role === "super_admin") {
    return [...SCHOOL_ADMIN_PAGES];
  }

  return [];
}
