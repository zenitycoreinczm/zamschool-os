import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyRateLimit, getClientIp } from "@/lib/server-guards";

/**
 * Lightweight liveness probe for load tests, uptime monitors, and k6.
 * Does not hit Supabase - use /api/health/ready for dependency checks later.
 * High rate limit keeps probes healthy while blocking naive flood abuse.
 */
export async function GET(req: Request) {
  const rate = await applyRateLimit({
    key: `public-health:${getClientIp(req)}`,
    limit: 300,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  return applyEdgeCacheHeaders(
    NextResponse.json({
      ok: true,
      service: "zamschool-os",
      timestamp: new Date().toISOString(),
    }),
    "publicHealth",
  );
}