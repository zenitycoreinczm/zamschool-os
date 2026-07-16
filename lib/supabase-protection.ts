/**
 * ZamSchool OS - Supabase protection policy (source of truth for what may hit Postgres).
 *
 * Layer stack: Cloudflare → Next.js Cache-Control → in-memory hot-read → Redis (approved keys) → Supabase.
 */

export const SUPABASE_PROTECTION = {
  /** Middleware / API role cache (Edge uses in-memory only). */
  middlewareRoleTtlMs: 10 * 60 * 1000,
  /** Redis actor snapshot (role + schoolId). */
  redisRoleTtlSec: 15 * 60,
  /** Debounced unread badge counts (in-memory, per process). */
  unreadCountsTtlSec: 15,
  /** Workspace shell stable fields (profile, school name, term). */
  workspaceStableTtlSec: 120,
  /** Auth admin metadata (email_confirmed) - expensive admin API. */
  authMetaTtlSec: 300,
} as const;

/** Operations that must always reach Supabase (writes + auth). */
export const SUPABASE_ALWAYS_HIT = [
  "auth.login",
  "auth.signup",
  "auth.token_refresh",
  "attendance.write",
  "results.write",
  "payments.write",
  "profile.write",
  "messages.write",
  "notifications.write",
  "users.provision",
  "invitations.create",
] as const;

/** High-frequency reads that must be cached before Supabase. */
export const CACHE_BEFORE_SUPABASE = [
  "permission.role_check",
  "workspace.context",
  "unread.summary",
  "inbox.preview",
  "announcements.list",
  "dashboard.summary",
  "profile.non_sensitive",
  "school.settings",
] as const;

export type SupabaseRouteClass =
  | "critical_write"
  | "auth"
  | "volatile_read"
  | "cacheable_read"
  | "static";

export function classifyApiRoute(pathname: string, method: string): SupabaseRouteClass {
  const path = pathname.split("?")[0] || pathname;
  const verb = method.toUpperCase();

  if (verb !== "GET" && verb !== "HEAD") {
    if (path.startsWith("/api/auth/")) return "auth";
    return "critical_write";
  }

  if (
    path.startsWith("/api/account/unread") ||
    path.startsWith("/api/account/inbox") ||
    path.includes("/messages") && path.includes("/api/")
  ) {
    return "volatile_read";
  }

  if (
    path.startsWith("/api/account/workspace-context") ||
    path.startsWith("/api/account/announcements") ||
    path.startsWith("/api/admin/announcements") ||
    path.startsWith("/api/teacher/announcements") ||
    path.startsWith("/api/account/profile") ||
    path.startsWith("/api/admin/school") ||
    path.includes("/dashboard") ||
    path.includes("/bootstrap")
  ) {
    return "cacheable_read";
  }

  if (path === "/api/health") return "static";

  return "cacheable_read";
}

export function shouldUseHotReadCache(routeClass: SupabaseRouteClass): boolean {
  return routeClass === "cacheable_read" || routeClass === "volatile_read";
}