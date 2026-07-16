import { NextResponse } from "next/server";

/**
 * Cache-Control presets for Cloudflare + browser (ZamSchool OS playbook).
 * Use applyEdgeCacheHeaders() in route handlers, or applyApiCachePolicy() from middleware.
 */

export const EDGE_CACHE = {
  /** Dashboard/summary reads - brief per-user cache. */
  privateRead: "private, max-age=60, stale-while-revalidate=180",
  /** Workspace shell context. */
  privateWorkspace: "private, max-age=90, stale-while-revalidate=300",
  /** Student/parent profile reads (2–5 min). */
  profileRead: "private, max-age=180, stale-while-revalidate=300",
  /** School settings / admin school profile (10–30 min). */
  schoolSettings: "private, max-age=600, stale-while-revalidate=1800",
  /** Announcements & notices (5–15 min). */
  announcements: "private, max-age=300, stale-while-revalidate=600",
  /** Events and attendance summaries (2–5 min SWR). */
  eventsRead: "private, max-age=60, stale-while-revalidate=300",
  /** Dashboard summaries - slightly longer SWR for read-heavy teacher/parent/student dashboards. */
  dashboardRead: "private, max-age=90, stale-while-revalidate=300",
  /** Inbox badges, auth, attendance, results, mutations - never cache. */
  noStore: "private, no-store, max-age=0, must-revalidate",
  /** Public CDN assets. */
  publicAsset: "public, max-age=86400, stale-while-revalidate=604800",
  /** Health probe. */
  publicHealth: "public, max-age=10, stale-while-revalidate=30",
} as const;

export type EdgeCachePreset = keyof typeof EDGE_CACHE;

export function applyEdgeCacheHeaders(
  response: NextResponse,
  preset: EdgeCachePreset = "privateRead"
): NextResponse {
  response.headers.set("Cache-Control", EDGE_CACHE[preset]);
  response.headers.set("CDN-Cache-Control", EDGE_CACHE[preset]);
  if (preset !== "noStore" && preset !== "publicAsset" && preset !== "publicHealth") {
    response.headers.set("Vary", "Authorization, Cookie");
  }
  return response;
}

/** @deprecated Use EDGE_CACHE.privateRead - kept for existing imports. */
export const READ_MOSTLY_PRIVATE_CACHE = EDGE_CACHE.privateRead;

const NO_STORE_PATH_PREFIXES = [
  "/api/auth/",
  "/api/account/messages",
  "/api/account/inbox-preview",
  "/api/account/unread-summary",
  "/api/teacher/messages",
  "/api/admin/messages",
] as const;

const NO_STORE_PATH_SEGMENTS = ["/attendance", "/results"] as const;

const ANNOUNCEMENT_PREFIXES = [
  "/api/admin/announcements",
  "/api/account/announcements",
  "/api/teacher/announcements",
] as const;

const EVENTS_PREFIXES = [
  "/api/account/events",
  "/api/admin/events",
  "/api/teacher/events",
] as const;

const DASHBOARD_PREFIXES = [
  "/api/teacher/dashboard",
  "/api/parent/dashboard",
  "/api/student/dashboard",
] as const;

const PROFILE_PREFIXES = ["/api/account/profile", "/api/account/avatar"] as const;

const SCHOOL_SETTINGS_PREFIXES = ["/api/admin/school", "/api/school/"] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => {
    if (pathname === prefix) return true;
    const base = prefix.endsWith("/") ? prefix : `${prefix}/`;
    return pathname.startsWith(base);
  });
}

function matchesSegment(pathname: string, segments: readonly string[]) {
  return segments.some((segment) => pathname.includes(segment));
}

/**
 * Picks a Cache-Control preset from path + HTTP method (used by middleware and routes).
 */
export function resolveEdgeCachePreset(pathname: string, method: string): EdgeCachePreset {
  const normalized = (pathname.split("?")[0] || pathname).replace(/\/+$/, "") || "/";
  const verb = method.toUpperCase();

  if (verb !== "GET" && verb !== "HEAD") {
    return "noStore";
  }

  if (
    matchesPrefix(normalized, NO_STORE_PATH_PREFIXES) ||
    matchesSegment(normalized, NO_STORE_PATH_SEGMENTS)
  ) {
    return "noStore";
  }

  if (normalized === "/api/health") {
    return "publicHealth";
  }

  if (matchesPrefix(normalized, SCHOOL_SETTINGS_PREFIXES)) {
    return "schoolSettings";
  }

  if (matchesPrefix(normalized, ANNOUNCEMENT_PREFIXES)) {
    return "announcements";
  }

  if (matchesPrefix(normalized, EVENTS_PREFIXES)) {
    return "eventsRead";
  }

  if (matchesPrefix(normalized, DASHBOARD_PREFIXES)) {
    return "dashboardRead";
  }

  if (matchesPrefix(normalized, PROFILE_PREFIXES)) {
    return "profileRead";
  }

  if (normalized === "/api/account/workspace-context") {
    return "privateWorkspace";
  }

  if (
    normalized.startsWith("/api/account/unread") ||
    normalized.startsWith("/api/account/inbox")
  ) {
    return "noStore";
  }

  return "privateRead";
}

/**
 * Applies playbook cache headers for API responses (middleware + optional route use).
 */
export function applyApiCachePolicy(
  pathname: string,
  method: string,
  response: NextResponse
): NextResponse {
  const preset = resolveEdgeCachePreset(pathname, method);
  return applyEdgeCacheHeaders(response, preset);
}

export function jsonWithEdgeCache<T>(
  body: T,
  init: ResponseInit | undefined,
  preset: EdgeCachePreset
) {
  const response = NextResponse.json(body, init);
  return applyEdgeCacheHeaders(response, preset);
}

const NO_CACHE_PAGE_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/first-login",
  "/verify-email",
  "/auth/callback",
  "/accept-invitation",
] as const;

export function applyPageCachePolicy(pathname: string, response: NextResponse): NextResponse {
  if (NO_CACHE_PAGE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return applyEdgeCacheHeaders(response, "noStore");
  }
  return response;
}