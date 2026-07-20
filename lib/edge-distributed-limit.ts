/**
 * Distributed edge rate limits for middleware (proxy.ts).
 *
 * Why: per-isolate memory flood alone can be bypassed by fanning traffic across
 * many Vercel serverless isolates — burning Hobby function invocations and
 * Supabase quota. Upstash fixed-window INCR closes that gap.
 *
 * Cost control: after Redis allows, a short local bypass skips Redis for a few
 * hits so normal browsing does not 1:1 burn Upstash commands.
 *
 * Fail-open on Redis blips so a Redis outage does not take the whole site down.
 */

import { freeTierDistributedEdgeLimits, isFreeTierMode } from "./free-tier-guard";
import { isRedisConfigured, redisIncr } from "./redis/client";
import { rateLimitKey } from "./redis/keys";
import { clampRedisTtl } from "./redis/ttl";

type Surface = "auth" | "api" | "page";

type BypassEntry = { expiresAt: number; remaining: number };
const localBypass = new Map<string, BypassEntry>();
const BYPASS_MAX_KEYS = 8_000;

function windowBucket(windowSec: number): number {
  return Math.floor(Date.now() / (windowSec * 1000));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((tomorrow.getTime() - Date.now()) / 1000));
}

function takeLocalBypass(key: string): boolean {
  const now = Date.now();
  const entry = localBypass.get(key);
  if (!entry) return false;
  if (entry.expiresAt <= now || entry.remaining <= 0) {
    localBypass.delete(key);
    return false;
  }
  entry.remaining -= 1;
  if (entry.remaining <= 0) localBypass.delete(key);
  else localBypass.set(key, entry);
  return true;
}

function grantLocalBypass(key: string, maxRequests: number, ttlMs: number) {
  if (localBypass.size >= BYPASS_MAX_KEYS) {
    const first = localBypass.keys().next().value;
    if (first !== undefined) localBypass.delete(first);
  }
  localBypass.set(key, {
    expiresAt: Date.now() + ttlMs,
    remaining: Math.max(0, maxRequests - 1),
  });
}

export type EdgeDistributedResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number; reason: "minute" | "daily" };

/**
 * Check distributed free-tier edge limits for a client IP + surface.
 * No-ops (allows) when free-tier mode is off or Redis is not configured.
 */
export async function checkEdgeDistributedLimit(params: {
  ip: string;
  surface: Surface;
  /** When true (suspicious UA), use half the free-tier minute budget. */
  suspicious?: boolean;
}): Promise<EdgeDistributedResult> {
  if (!isFreeTierMode()) {
    return { allowed: true };
  }

  const ip = String(params.ip || "").trim() || "unknown";
  if (ip === "unknown") {
    // Still enforce a conservative local-only path when IP is missing.
    // Redis key would collide across clients — skip distributed for unknown.
    return { allowed: true };
  }

  if (!isRedisConfigured()) {
    return { allowed: true };
  }

  const limits = freeTierDistributedEdgeLimits();
  const surfaceLimit = limits[params.surface];
  const maxMinute = params.suspicious
    ? Math.max(3, Math.floor(surfaceLimit.maxRequests / 2))
    : surfaceLimit.maxRequests;

  const bypassKey = `edge-bypass:${params.surface}:${ip}`;
  if (takeLocalBypass(bypassKey)) {
    return { allowed: true };
  }

  try {
    // Minute fixed window
    const bucket = windowBucket(surfaceLimit.windowSec);
    const minuteKey = rateLimitKey(
      `edge:${params.surface}`,
      `${ip}:${bucket}`,
    );
    const minuteCount = await redisIncr(
      minuteKey,
      clampRedisTtl(surfaceLimit.windowSec + 5),
    );

    if (minuteCount !== null && minuteCount > maxMinute) {
      return {
        allowed: false,
        retryAfterSec: Math.max(
          1,
          surfaceLimit.windowSec - (Math.floor(Date.now() / 1000) % surfaceLimit.windowSec),
        ),
        reason: "minute",
      };
    }

    // Daily hard cap for API only (protects Vercel invocation + Supabase burn).
    if (params.surface === "api") {
      const day = todayUtc();
      const dailyKey = rateLimitKey("edge:api-day", `${ip}:${day}`);
      const dailyCount = await redisIncr(
        dailyKey,
        clampRedisTtl(secondsUntilUtcMidnight()),
      );
      if (dailyCount !== null && dailyCount > limits.apiDaily.maxRequests) {
        return {
          allowed: false,
          retryAfterSec: secondsUntilUtcMidnight(),
          reason: "daily",
        };
      }
    }

    grantLocalBypass(
      bypassKey,
      limits.localBypass.maxRequests,
      limits.localBypass.ttlMs,
    );
    return { allowed: true };
  } catch {
    // Fail open — Redis outage must not brick the app.
    return { allowed: true };
  }
}

/** Test helper */
export function resetEdgeDistributedBypassForTests() {
  localBypass.clear();
}
