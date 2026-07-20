/**
 * Data-center / national-scale server security policy for ZamSchool OS.
 *
 * Goal: when hosting all Zambian schools, the origin server must:
 * - Reject host-header attacks and oversize payloads early
 * - Honour distributed IP bans (Redis) after abuse
 * - Fail closed on missing production secrets
 * - Never trust client-supplied identity without verification
 */

import {
  hashRedisIdentifier,
  rateLimitKey,
} from "@/lib/redis/keys";
import { freeTierIpAbusePolicy } from "@/lib/free-tier-guard";

/** Max body size for general API mutations (bytes). Uploads use dedicated routes. */
export const MAX_API_BODY_BYTES = 1_048_576; // 1 MiB
/** Max body size for file authorize / multipart paths. */
export const MAX_UPLOAD_BODY_BYTES = 25 * 1_048_576; // 25 MiB

const freeAbuse = freeTierIpAbusePolicy();

/** Temporary ban duration after repeated abuse (shorter/longer by free-tier mode). */
export const IP_BAN_TTL_SEC = freeAbuse.banTtlSec;
/** Abuse events before temporary ban (lower on free tier so scrapers die faster). */
export const IP_ABUSE_BAN_THRESHOLD = freeAbuse.banThreshold;
/** Window for counting abuse events. */
export const IP_ABUSE_WINDOW_SEC = freeAbuse.windowSec;

const DISALLOWED_METHODS = new Set(["TRACE", "TRACK"]);

export function isProductionServerMode(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.ZAMSCHOOL_DC_MODE === "true"
  );
}

/**
 * Hostnames this origin is allowed to answer for.
 * Prevents host-header injection / cache poisoning in multi-tenant DC deploys.
 */
export function collectAllowedHosts(): string[] {
  const hosts = new Set<string>();

  const add = (raw: string | undefined) => {
    const value = String(raw || "").trim();
    if (!value) return;
    for (const part of value.split(",")) {
      const host = part.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0];
      if (host) hosts.add(host);
    }
  };

  add(process.env.ALLOWED_HOSTS);
  add(process.env.NEXT_PUBLIC_APP_ORIGIN);
  add(process.env.NEXT_PUBLIC_WEBAPP_ORIGIN);
  add(process.env.NEXT_PUBLIC_APP_URL);
  add(process.env.NEXT_PUBLIC_WEB_ORIGIN);
  add(process.env.VERCEL_URL);

  // Local development always allowed.
  hosts.add("localhost");
  hosts.add("127.0.0.1");
  hosts.add("0.0.0.0");

  return [...hosts];
}

export function isAllowedRequestHost(hostHeader: string | null): boolean {
  const raw = String(hostHeader || "").trim().toLowerCase();
  if (!raw) return !isProductionServerMode();

  const host = raw.split(",")[0]?.trim().split(":")[0] || "";
  if (!host) return false;

  const allowed = collectAllowedHosts();
  // In development with empty ALLOWED_HOSTS beyond loopback, still allow.
  if (!isProductionServerMode() && allowed.length <= 3) {
    return true;
  }

  if (allowed.includes(host)) return true;

  // Vercel preview hosts (optional).
  if (
    process.env.ALLOW_VERCEL_PREVIEW_HOSTS === "true" &&
    host.endsWith(".vercel.app")
  ) {
    return true;
  }

  return false;
}

export function isDisallowedHttpMethod(method: string): boolean {
  return DISALLOWED_METHODS.has(String(method || "").toUpperCase());
}

export function resolveMaxBodyBytes(pathname: string): number {
  const path = pathname.split("?")[0] || pathname;
  if (
    path.startsWith("/api/files/") ||
    path.startsWith("/api/upload/") ||
    path.includes("/avatar") ||
    path.includes("/import")
  ) {
    return MAX_UPLOAD_BODY_BYTES;
  }
  return MAX_API_BODY_BYTES;
}

/**
 * Reject oversize Content-Length early (before handlers buffer the body).
 * Missing Content-Length is allowed (chunked) - route handlers still validate.
 */
export function isContentLengthAllowed(
  contentLengthHeader: string | null,
  pathname: string,
): boolean {
  if (!contentLengthHeader) return true;
  const n = Number(contentLengthHeader);
  if (!Number.isFinite(n) || n < 0) return false;
  return n <= resolveMaxBodyBytes(pathname);
}

/** Static denylist from env: SECURITY_BLOCKED_IPS=1.2.3.4,5.6.7.8 */
export function isIpOnStaticBlocklist(ip: string): boolean {
  const list = String(process.env.SECURITY_BLOCKED_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return false;
  const normalized = String(ip || "").trim();
  return list.includes(normalized);
}

export function ipBanRedisKey(ip: string): string {
  return rateLimitKey("ipban", hashRedisIdentifier(ip));
}

export function ipAbuseRedisKey(ip: string): string {
  return rateLimitKey("ipabuse", hashRedisIdentifier(ip));
}

/**
 * Production boot requirements for a national multi-tenant deploy.
 * Returns human-readable failures (empty = healthy).
 */
export function evaluateProductionSecurityGates(): string[] {
  if (!isProductionServerMode()) return [];

  const failures: string[] = [];

  if (!process.env.UPSTASH_REDIS_REST_URL?.trim() || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    failures.push("UPSTASH_REDIS_REST_URL/TOKEN required for distributed rate limits and login lockout");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    failures.push("NEXT_PUBLIC_SUPABASE_URL required");
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    failures.push("NEXT_PUBLIC_SUPABASE_ANON_KEY required");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    failures.push("SUPABASE_SERVICE_ROLE_KEY required on server only");
  }
  if (
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    failures.push("SERVICE_ROLE_KEY must not equal ANON_KEY");
  }
  if (process.env.ENABLE_UNSAFE_DEV_ROUTES === "true") {
    failures.push("ENABLE_UNSAFE_DEV_ROUTES must not be true in production");
  }
  if (process.env.NEXT_PUBLIC_DISABLE_SUPABASE_GUARD === "true") {
    failures.push(
      "NEXT_PUBLIC_DISABLE_SUPABASE_GUARD must not be true in production",
    );
  }
  const hasCorsOrigin =
    Boolean(process.env.CORS_ALLOWED_ORIGINS?.trim()) ||
    Boolean(process.env.NEXT_PUBLIC_APP_ORIGIN?.trim()) ||
    Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
  if (!hasCorsOrigin) {
    failures.push(
      "CORS_ALLOWED_ORIGINS or NEXT_PUBLIC_APP_ORIGIN required for strict CORS",
    );
  }

  const loopback = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const allHosts = collectAllowedHosts();
  const publicHosts = allHosts.filter((h) => !loopback.has(h));
  const onlyLoopback =
    publicHosts.length === 0 && allHosts.some((h) => loopback.has(h));

  // Local `npm run start` is production NODE_ENV but may only use localhost.
  // Require a public hostname for real deploys / data-center strict mode.
  if (publicHosts.length === 0) {
    if (onlyLoopback && process.env.ZAMSCHOOL_DC_STRICT !== "true") {
      // Allowed for local production smoke tests.
    } else {
      failures.push(
        "ALLOWED_HOSTS or NEXT_PUBLIC_APP_ORIGIN must define public hostnames (e.g. app.zamschool.zm)",
      );
    }
  }

  return failures;
}
