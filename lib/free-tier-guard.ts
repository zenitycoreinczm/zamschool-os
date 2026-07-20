/**
 * Free-tier / Hobby protection defaults.
 *
 * Goal: keep Vercel (function time + bandwidth), Supabase (req/s + DB),
 * and Upstash (commands/day) from burning on abuse or scrapers while
 * still serving a normal school workload.
 *
 * Stack:
 *   Cloudflare (WAF / gateway) → edge memory flood → Upstash distributed
 *   edge limits → route-level Redis limits → Supabase request budget.
 *
 * Opt out only with ZAMSCHOOL_FREE_TIER=false (paid scale-out).
 */

export function isFreeTierMode(): boolean {
  if (process.env.ZAMSCHOOL_FREE_TIER === "false") return false;
  if (process.env.ZAMSCHOOL_FREE_TIER === "true") return true;
  // Production defaults to free-tier protection (Hobby).
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1"
  );
}

/** Per-IP edge flood ceilings (middleware / proxy) — L1 per-isolate. */
export function freeTierFloodLimits(): {
  auth: { normal: number; suspicious: number };
  api: { normal: number; suspicious: number };
  page: { normal: number; suspicious: number };
  windowMs: number;
} {
  if (!isFreeTierMode()) {
    return {
      auth: { normal: 60, suspicious: 20 },
      api: { normal: 180, suspicious: 60 },
      page: { normal: 300, suspicious: 120 },
      windowMs: 60_000,
    };
  }
  // Tight Hobby ceilings — legitimate school traffic stays well under these.
  // These are per-isolate; Redis distributed limits (below) close multi-isolate gaps.
  return {
    auth: { normal: 18, suspicious: 6 },
    api: { normal: 50, suspicious: 15 },
    page: { normal: 70, suspicious: 20 },
    windowMs: 60_000,
  };
}

/**
 * Distributed (Upstash) edge ceilings shared across all Vercel isolates.
 * Fixed-window INCR — cheaper than sliding-window Lua for hot middleware path.
 * Local bypass after a Redis allow cuts Upstash command burn ~3–5×.
 */
export function freeTierDistributedEdgeLimits(): {
  auth: { maxRequests: number; windowSec: number };
  api: { maxRequests: number; windowSec: number };
  page: { maxRequests: number; windowSec: number };
  /** Daily hard cap per IP for /api/* (stops sustained scrapers). */
  apiDaily: { maxRequests: number };
  /** After Redis allows, skip Redis for this many local hits within ttl. */
  localBypass: { maxRequests: number; ttlMs: number };
} {
  if (!isFreeTierMode()) {
    return {
      auth: { maxRequests: 80, windowSec: 60 },
      api: { maxRequests: 240, windowSec: 60 },
      page: { maxRequests: 400, windowSec: 60 },
      apiDaily: { maxRequests: 20_000 },
      localBypass: { maxRequests: 4, ttlMs: 2_000 },
    };
  }
  return {
    auth: { maxRequests: 25, windowSec: 60 },
    api: { maxRequests: 70, windowSec: 60 },
    page: { maxRequests: 100, windowSec: 60 },
    // ~1 sustained req/s for 30 min, or normal school day with headroom.
    apiDaily: { maxRequests: 2_500 },
    localBypass: { maxRequests: 3, ttlMs: 2_000 },
  };
}

/**
 * Paths that must never invoke a serverless function in production.
 * Route handlers already 404, but edge-blocking saves Vercel invocation quota.
 */
export function isProductionInvocationBlockedPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || pathname).toLowerCase();
  if (path.startsWith("/api/debug")) return true;
  if (path === "/api/test-email" || path.startsWith("/api/test-email/")) return true;
  // Load-test / internal probes if ever exposed
  if (path.startsWith("/api/load-test")) return true;
  // Accidental tooling endpoints
  if (path.startsWith("/api/__")) return true;
  return false;
}

/** Public unauthenticated API rate presets (per identifier / window). */
export function freeTierPublicRateLimits(): {
  default: { windowMs: number; maxRequests: number };
  login: { windowMs: number; maxRequests: number };
  signup: { windowMs: number; maxRequests: number };
  authBurst: { windowMs: number; maxRequests: number };
} {
  if (!isFreeTierMode()) {
    return {
      default: { windowMs: 60_000, maxRequests: 20 },
      login: { windowMs: 5 * 60_000, maxRequests: 5 },
      signup: { windowMs: 15 * 60_000, maxRequests: 3 },
      authBurst: { windowMs: 60_000, maxRequests: 12 },
    };
  }
  return {
    default: { windowMs: 60_000, maxRequests: 10 },
    login: { windowMs: 5 * 60_000, maxRequests: 4 },
    signup: { windowMs: 15 * 60_000, maxRequests: 2 },
    authBurst: { windowMs: 60_000, maxRequests: 6 },
  };
}

/**
 * Platform API presets used by applyPlatformRateLimit.
 * Free-tier values keep Vercel/Supabase under control for a single school pilot.
 */
export function freeTierPlatformRatePresets(): Record<
  string,
  { limit: number; windowMs: number }
> {
  const free = isFreeTierMode();
  const w = 60_000;
  return {
    messagesRead: { limit: free ? 18 : 30, windowMs: w },
    messagesWrite: { limit: free ? 8 : 12, windowMs: w },
    unreadSummary: { limit: free ? 30 : 60, windowMs: w },
    workspaceContext: {
      limit: process.env.NODE_ENV === "development" ? 300 : free ? 36 : 60,
      windowMs: w,
    },
    teacherBootstrap: { limit: free ? 5 : 8, windowMs: w },
    teacherDashboard: { limit: free ? 12 : 20, windowMs: w },
    teacherClasses: { limit: free ? 40 : 120, windowMs: w },
    teacherStudents: { limit: free ? 30 : 60, windowMs: w },
    teacherSubjects: { limit: free ? 40 : 120, windowMs: w },
    teacherResultsCompleteness: { limit: free ? 30 : 60, windowMs: w },
    teacherAttendanceWrite: { limit: free ? 30 : 60, windowMs: w },
    accountContacts: { limit: free ? 12 : 20, windowMs: w },
    heavyRead: { limit: free ? 12 : 25, windowMs: w },
    uploadAuthorize: { limit: free ? 10 : 20, windowMs: w },
    uploadValidate: { limit: free ? 10 : 20, windowMs: w },
  };
}

/** Cloudflare gateway worker presets (mirrored in workers/gateway). */
export function freeTierGatewayRateLimits(): {
  default: { windowSec: number; maxRequests: number };
  upload: { windowSec: number; maxRequests: number };
  read: { windowSec: number; maxRequests: number };
  mutation: { windowSec: number; maxRequests: number };
  anonymous: { windowSec: number; maxRequests: number };
} {
  if (!isFreeTierMode()) {
    return {
      default: { windowSec: 60, maxRequests: 120 },
      upload: { windowSec: 60, maxRequests: 20 },
      read: { windowSec: 60, maxRequests: 120 },
      mutation: { windowSec: 60, maxRequests: 60 },
      anonymous: { windowSec: 60, maxRequests: 30 },
    };
  }
  return {
    default: { windowSec: 60, maxRequests: 60 },
    upload: { windowSec: 60, maxRequests: 10 },
    read: { windowSec: 60, maxRequests: 60 },
    mutation: { windowSec: 60, maxRequests: 30 },
    anonymous: { windowSec: 60, maxRequests: 12 },
  };
}

/** IP reputation: ban sooner / longer on free tier so scrapers cannot re-hammer. */
export function freeTierIpAbusePolicy(): {
  banThreshold: number;
  banTtlSec: number;
  windowSec: number;
} {
  if (!isFreeTierMode()) {
    return { banThreshold: 25, banTtlSec: 60 * 60, windowSec: 15 * 60 };
  }
  return {
    banThreshold: 10,
    banTtlSec: 2 * 60 * 60,
    windowSec: 15 * 60,
  };
}
