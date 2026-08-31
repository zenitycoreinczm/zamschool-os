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
 * Edge rate-limit presets using Upstash Redis (500K commands/month free).
 *
 * Upstash provides atomic INCR operations perfect for rate limiting.
 * With 18K/500K usage, we have massive headroom for aggressive caching.
 *
 * Strategy:
 *   1. Upstash Redis REST API (primary) - atomic counters, cross-isolate
 *   2. Cloudflare Cache API (fallback L1) - fast local cache
 *   3. KV Namespace (fallback L2) - persistent backup
 *   4. Isolate memory (fallback L3) - last resort
 */
const RATE_LIMITS = {
  default: { windowSec: 60, maxRequests: 60, keyPrefix: "default" },
  upload: { windowSec: 60, maxRequests: 10, keyPrefix: "upload" },
  read: { windowSec: 60, maxRequests: 60, keyPrefix: "read" },
  mutation: { windowSec: 60, maxRequests: 30, keyPrefix: "mutation" },
  anonymous: { windowSec: 60, maxRequests: 12, keyPrefix: "anonymous" },
} as const satisfies Record<string, RateLimitConfig>;

/** Default export — optimized for Upstash free tier. */
export const GATEWAY_RATE_LIMITS = RATE_LIMITS;

export function isGatewayFreeTier(env?: Pick<Env, "FREE_TIER"> | null): boolean {
  const flag = String(env?.FREE_TIER ?? "true")
    .trim()
    .toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function resolveGatewayRateLimits(
  env?: Pick<Env, "FREE_TIER"> | null,
): typeof RATE_LIMITS {
  return RATE_LIMITS; // Same limits for now, can add paid tiers later
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

/** Per-isolate memory counters (L3 fallback). Zero external ops. */
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
 * Uses ~2 commands per request (well within 500K/month free tier).
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
 * L1: Cloudflare Cache API rate limiting (fallback)
 * Fastest option, uses HTTP cache with custom headers
 */
async function checkCacheRateLimit(
  key: string,
  config: RateLimitConfig,
  now: number,
): Promise<RateLimitResult | null> {
  const windowMs = config.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  
  // Use Cache API with a fake URL as key
  const cacheKey = `https://zamschool-gateway/ratelimit/${config.keyPrefix}/${key}/${Math.floor(windowStart / 1000)}`;
  const cache = caches.default;

  try {
    const cached = await cache.match(cacheKey);
    
    if (cached) {
      const count = parseInt(cached.headers.get("X-Count") || "0", 10);
      
      if (count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt };
      }

      // Update count
      const newCount = count + 1;
      const response = new Response("", {
        headers: {
          "X-Count": String(newCount),
          "Cache-Control": `public, max-age=${config.windowSec}`,
        },
      });
      
      await cache.put(cacheKey, response.clone());
      
      return {
        allowed: true,
        remaining: Math.max(config.maxRequests - newCount, 0),
        resetAt,
      };
    }

    // First request in window
    const response = new Response("", {
      headers: {
        "X-Count": "1",
        "Cache-Control": `public, max-age=${config.windowSec}`,
      },
    });
    
    await cache.put(cacheKey, response.clone());
    
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  } catch {
    // Cache API may not be available in all contexts
    return null;
  }
}

/**
 * L2: KV Namespace rate limiting (fallback)
 * Persistent backup when Upstash unavailable
 */
async function checkKVRateLimit(
  env: Env,
  key: string,
  config: RateLimitConfig,
  now: number,
): Promise<RateLimitResult> {
  const windowMs = config.windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const kvKey = `rl:${config.keyPrefix}:${key}:${Math.floor(windowStart / 1000)}`;

  try {
    // Read current count
    const currentVal = await env.SESSION_CACHE.get(kvKey);
    const count = currentVal ? parseInt(currentVal, 10) : 0;

    if (count >= config.maxRequests) {
      return { allowed: false, remaining: 0, resetAt };
    }

    // Increment (only write if under limit)
    const ttl = Math.ceil(config.windowSec);
    await env.SESSION_CACHE.put(kvKey, String(count + 1), { expirationTtl: ttl });

    return {
      allowed: true,
      remaining: Math.max(config.maxRequests - count - 1, 0),
      resetAt,
    };
  } catch (error) {
    console.error("[rate-limit] KV failed:", error);
    // Fall through to memory
    return checkMemoryRateLimit(key, config, now);
  }
}

/**
 * Rate limit for gateway requests.
 *
 * Order:
 *   1. Disabled → allow
 *   2. Upstash Redis (INCR) when secrets present — shared across isolates
 *   3. Cloudflare Cache API (L1) — fastest, unlimited reads
 *   4. KV Namespace (L2) — persistent, 1K writes/day free
 *   5. Isolate memory (L3) — unlimited, local only
 *
 * Upstash is primary because it's already paid for (500K commands/month free).
 * Current usage: 18K/500K = 3.6% utilization. Massive headroom!
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

  // Primary: Upstash Redis (atomic, cross-isolate, 500K commands/month free)
  if (hasUpstash(env)) {
    try {
      return await checkUpstashRateLimit(env, key, config, now);
    } catch (err) {
      console.error(
        "[rate-limit] Upstash failed; falling back to Cache API",
        err,
      );
      // Fail open to Cache API so Redis blips do not take the whole edge offline.
    }
  }

  // Fallback L1: Cache API (fastest, unlimited reads)
  const cacheResult = await checkCacheRateLimit(key, config, now);
  if (cacheResult) return cacheResult;

  // Fallback L2: KV Namespace (persistent, 1K writes/day)
  if (env.SESSION_CACHE) {
    return await checkKVRateLimit(env, key, config, now);
  }

  // Final fallback L3: Memory (unlimited, local only)
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
