import type { Env, SessionSnapshot } from "./types.ts";

export interface RateLimitConfig {
  /** Fixed window size in seconds */
  windowSec: number;
  maxRequests: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Edge rate-limit presets (Redis / isolate memory — not KV).
 *
 * Defaults are free-tier / Hobby safe so gateway traffic cannot burn
 * Vercel or Supabase quotas. Paid scale-out: set FREE_TIER=false in
 * wrangler vars and use resolveGatewayRateLimits(env).
 */
const FREE_TIER_LIMITS = {
  default: { windowSec: 60, maxRequests: 60, keyPrefix: "default" },
  upload: { windowSec: 60, maxRequests: 10, keyPrefix: "upload" },
  read: { windowSec: 60, maxRequests: 60, keyPrefix: "read" },
  mutation: { windowSec: 60, maxRequests: 30, keyPrefix: "mutation" },
  anonymous: { windowSec: 60, maxRequests: 12, keyPrefix: "anonymous" },
} as const satisfies Record<string, RateLimitConfig>;

const PAID_LIMITS = {
  default: { windowSec: 60, maxRequests: 120, keyPrefix: "default" },
  upload: { windowSec: 60, maxRequests: 20, keyPrefix: "upload" },
  read: { windowSec: 60, maxRequests: 120, keyPrefix: "read" },
  mutation: { windowSec: 60, maxRequests: 60, keyPrefix: "mutation" },
  anonymous: { windowSec: 60, maxRequests: 30, keyPrefix: "anonymous" },
} as const satisfies Record<string, RateLimitConfig>;

/** Default export used by tests and static imports — free-tier safe. */
export const GATEWAY_RATE_LIMITS = FREE_TIER_LIMITS;

export function isGatewayFreeTier(env?: Pick<Env, "FREE_TIER"> | null): boolean {
  const flag = String(env?.FREE_TIER ?? "true")
    .trim()
    .toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function resolveGatewayRateLimits(
  env?: Pick<Env, "FREE_TIER"> | null,
): typeof FREE_TIER_LIMITS | typeof PAID_LIMITS {
  return isGatewayFreeTier(env) ? FREE_TIER_LIMITS : PAID_LIMITS;
}

function isRateLimitEnabled(env: Env): boolean {
  return String(env.RATE_LIMIT_ENABLED || "").toLowerCase() === "true";
}

function hasUpstash(env: Env): boolean {
  return Boolean(
    String(env.UPSTASH_REDIS_REST_URL || "").trim() &&
      String(env.UPSTASH_REDIS_REST_TOKEN || "").trim(),
  );
}

/** Per-isolate memory counters (L1). Zero KV/Redis when Redis unset. */
const memoryBuckets = new Map<string, { count: number; windowStart: number }>();
const MEMORY_MAX_KEYS = 5_000;

function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number,
): RateLimitResult {
  const windowMs = config.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;

  let entry = memoryBuckets.get(key);
  if (!entry || entry.windowStart !== windowStart) {
    if (memoryBuckets.size >= MEMORY_MAX_KEYS) {
      const first = memoryBuckets.keys().next().value;
      if (first !== undefined) memoryBuckets.delete(first);
    }
    entry = { count: 0, windowStart };
    memoryBuckets.set(key, entry);
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: Math.max(config.maxRequests - entry.count, 0),
    resetAt,
  };
}

/**
 * Upstash REST pipeline: INCR + EXPIRE (only when count === 1).
 * One HTTP round-trip, no Cloudflare KV ops.
 */
async function checkUpstashRateLimit(
  env: Env,
  key: string,
  config: RateLimitConfig,
  now: number,
): Promise<RateLimitResult> {
  const windowMs = config.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const redisKey = `gw:rl:${key}:${windowStart}`;

  const base = String(env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
  const token = String(env.UPSTASH_REDIS_REST_TOKEN || "").trim();

  // Pipeline: INCR, then EXPIRE only sets TTL on first hit (idempotent enough).
  const res = await fetch(`${base}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(config.windowSec + 5)],
    ]),
  });

  if (!res.ok) {
    throw new Error(`Upstash pipeline HTTP ${res.status}`);
  }

  const body = (await res.json()) as Array<{ result?: number | string | null }>;
  const count = Number(body?.[0]?.result ?? 0);

  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("Upstash INCR returned invalid count");
  }

  if (count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt };
  }

  return {
    allowed: true,
    remaining: Math.max(config.maxRequests - count, 0),
    resetAt,
  };
}

/**
 * Rate limit for gateway requests.
 *
 * Order:
 *   1. Disabled → allow
 *   2. Upstash Redis (INCR) when secrets present — shared across isolates
 *   3. Isolate memory — 0 external ops (best-effort per edge location)
 *
 * Intentionally does **not** use Cloudflare KV (RATE_LIMITS). KV GET+PUT on
 * every request burns the free KV ops budget; Redis INCR is the right tool.
 */
export async function checkGatewayRateLimit(
  env: Env,
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const now = Date.now();
  const resetAt = now + config.windowSec * 1000;
  const key = `${config.keyPrefix}:${identifier}`;

  if (!isRateLimitEnabled(env)) {
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  if (hasUpstash(env)) {
    try {
      return await checkUpstashRateLimit(env, key, config, now);
    } catch (err) {
      console.error(
        "[rate-limit] Upstash failed; falling back to isolate memory",
        err,
      );
      // Fail open to memory so Redis blips do not take the whole edge offline.
      return checkMemoryRateLimit(key, config, now);
    }
  }

  return checkMemoryRateLimit(key, config, now);
}

export function rateLimitHeaders(
  result: RateLimitResult,
  config: RateLimitConfig,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(config.maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function resolveRateLimitKey(
  req: Request,
  session: SessionSnapshot | null,
): string {
  if (session) {
    return `${session.schoolId}:${session.userId}`;
  }

  const forwarded =
    req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0]?.trim() || "unknown"}`;
  }

  return "ip:unknown";
}

export function rateLimitExceededResponse(
  result: RateLimitResult,
  config: RateLimitConfig,
  extraHeaders: Record<string, string>,
): Response {
  return new Response("Too Many Requests", {
    status: 429,
    headers: {
      ...extraHeaders,
      ...rateLimitHeaders(result, config),
      "Retry-After": String(
        Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
      ),
    },
  });
}

/** Test helper */
export function resetRateLimitMemoryForTests() {
  memoryBuckets.clear();
}
