import { NextResponse } from "next/server";

import { applyRateLimit, getClientIp } from "@/lib/server-guards";
import { isRedisConfigured, redisPing } from "@/lib/redis/client";
import { isKvConfigured } from "@/lib/kv-client";
import { isR2CdnConfigured } from "@/lib/r2-config";

/**
 * Dependency readiness probe - boolean status only.
 * Does not expose architecture details, hostnames, or secrets.
 */
export async function GET(req: Request) {
  const rate = await applyRateLimit({
    key: `public-health-ready:${getClientIp(req)}`,
    limit: 60,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const redisConfigured = isRedisConfigured();
  let redisOk = false;
  if (redisConfigured) {
    redisOk = await redisPing();
  }

  const r2Credentials = Boolean(
    process.env.R2_ENDPOINT?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim(),
  );
  const r2PublicCdn = isR2CdnConfigured();
  const kvConfigured = isKvConfigured();
  const gatewayConfigured = Boolean(process.env.NEXT_PUBLIC_GATEWAY_URL?.trim());
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const freeTierProtected =
    process.env.ZAMSCHOOL_FREE_TIER !== "false" &&
    (process.env.ZAMSCHOOL_FREE_TIER === "true" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production");
  const supabaseGuardDisabled =
    process.env.NEXT_PUBLIC_DISABLE_SUPABASE_GUARD === "true";

  const production = process.env.NODE_ENV === "production";
  const redisRequired = production || redisConfigured;
  const ready = redisRequired ? redisOk : true;

  // Public probe: only booleans. No hostnames, stacks, job lists, or tokens.
  const body = {
    ok: ready,
    service: "zamschool-os",
    timestamp: new Date().toISOString(),
    checks: {
      redis: {
        configured: redisConfigured,
        reachable: redisOk,
        required: redisRequired,
      },
      storage: {
        configured: r2Credentials,
        publicCdn: r2PublicCdn,
      },
      supabase: {
        configured: supabaseConfigured,
        guardDisabled: supabaseGuardDisabled,
      },
      edge: {
        kvConfigured,
        gatewayConfigured,
      },
      protection: {
        freeTier: freeTierProtected,
      },
    },
  };

  return NextResponse.json(body, {
    status: ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
