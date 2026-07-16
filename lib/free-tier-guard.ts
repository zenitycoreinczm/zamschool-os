/**
 * Free-tier / Hobby protection defaults.
 *
 * Goal: keep Vercel (function time + bandwidth), Supabase (req/s + DB),
 * and Upstash (commands/day) from burning on abuse or scrapers while
 * still serving a normal school workload.
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

/** Per-IP edge flood ceilings (middleware / proxy). */
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
  // Tighter Hobby ceilings - legitimate school traffic stays well under these.
  return {
    auth: { normal: 30, suspicious: 10 },
    api: { normal: 90, suspicious: 30 },
    page: { normal: 120, suspicious: 40 },
    windowMs: 60_000,
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
    default: { windowMs: 60_000, maxRequests: 12 },
    login: { windowMs: 5 * 60_000, maxRequests: 5 },
    signup: { windowMs: 15 * 60_000, maxRequests: 2 },
    authBurst: { windowMs: 60_000, maxRequests: 8 },
  };
}
