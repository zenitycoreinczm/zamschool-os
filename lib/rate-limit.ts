import { NextResponse } from "next/server";
import { isKvConfigured, checkKvRateLimit } from "./kv-client";
import { isRedisConfigured, redisSlidingWindowHit } from "./redis/client";
import { rateLimitKey } from "@/lib/redis/keys";
import {
  freeTierPublicRateLimits,
  isFreeTierMode,
} from "@/lib/free-tier-guard";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const freePublic = freeTierPublicRateLimits();

export const RATE_LIMITS = {
  admin: {
    default: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 60 : 100 },
    heavy: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 20 : 30 },
    export: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 5 : 10 },
  },
  teacher: {
    default: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 50 : 80 },
    attendance: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 35 : 50 },
    results: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 20 : 30 },
  },
  parent: {
    default: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 40 : 60 },
    polling: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 20 : 30 },
    heavy: { windowMs: 60 * 1000, maxRequests: isFreeTierMode() ? 12 : 20 },
  },
  public: {
    default: freePublic.default,
    login: freePublic.login,
    signup: freePublic.signup,
    /** Stricter defaults for unauthenticated probing. */
    authBurst: freePublic.authBurst,
  },
} as const;

const slidingWindows = new Map<string, number[]>();
const burstCounters = new Map<string, number>();

function checkMemorySlidingWindow(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const kept = (slidingWindows.get(key) || []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (kept.length >= config.maxRequests) {
    const oldest = kept[0] ?? now;
    return {
      allowed: false,
      remaining: 0,
      resetTime: oldest + config.windowMs,
    };
  }

  kept.push(now);
  slidingWindows.set(key, kept);

  return {
    allowed: true,
    remaining: config.maxRequests - kept.length,
    resetTime: now + config.windowMs,
  };
}

/**
 * Rate limiter: Redis (primary) -> Cloudflare KV -> in-memory fallback.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const now = Date.now();
  const scope = config.keyPrefix || "default";

  if (isRedisConfigured()) {
    const redisResult = await redisSlidingWindowHit({
      key: rateLimitKey(scope, identifier),
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
    });
    if (redisResult) return redisResult;
  }

  if (isKvConfigured()) {
    const kvResult = await checkKvRateLimit(identifier, scope as any);
    return {
      allowed: kvResult.allowed,
      remaining: kvResult.remaining,
      resetTime: kvResult.reset || now + config.windowMs,
    };
  }

  const key = `rate_limit:${scope}:${identifier}`;
  return checkMemorySlidingWindow(key, config);
}

export async function rateLimitMiddleware(
  req: Request,
  identifier: string,
  config: RateLimitConfig,
): Promise<NextResponse | null> {
  const result = await checkRateLimit(identifier, config);

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(config.maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetTime / 1000)),
          "Retry-After": String(
            Math.ceil((result.resetTime - Date.now()) / 1000),
          ),
        },
      },
    );
  }

  return null;
}

export function getClientIdentifier(req: Request, userId?: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";

  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${ip}`;
}

export async function checkBurstLimit(
  userId: string,
  operation: string,
  maxConcurrent: number = 3,
): Promise<{ allowed: boolean; current: number }> {
  const key = rateLimitKey("burst", `${operation}:${userId}`);

  if (isRedisConfigured()) {
    const count = await import("./redis/client").then((m) =>
      m.redisIncr(key, 60),
    );
    if (count !== null) {
      if (count > maxConcurrent) {
        await import("./redis/client").then((m) => m.redisDecr(key));
        return { allowed: false, current: count - 1 };
      }
      return { allowed: true, current: count };
    }
  }

  const memKey = `burst:${operation}:${userId}`;
  const current = (burstCounters.get(memKey) || 0) + 1;
  if (current > maxConcurrent) {
    return { allowed: false, current: current - 1 };
  }
  burstCounters.set(memKey, current);
  if (current === 1) {
    setTimeout(() => burstCounters.delete(memKey), 60_000).unref?.();
  }
  return { allowed: true, current };
}

export async function releaseBurstLimit(
  userId: string,
  operation: string,
): Promise<void> {
  const key = rateLimitKey("burst", `${operation}:${userId}`);
  if (isRedisConfigured()) {
    const { redisDecr } = await import("./redis/client");
    await redisDecr(key);
    return;
  }
  const memKey = `burst:${operation}:${userId}`;
  const current = burstCounters.get(memKey) || 0;
  if (current <= 1) burstCounters.delete(memKey);
  else burstCounters.set(memKey, current - 1);
}

export { consumeDailyUsage, getDailyLimit } from "./daily-usage-limit";

export async function trackDailyUsage(
  userId: string,
  feature: string,
  increment: number = 1,
): Promise<{ current: number; limit: number; remaining: number }> {
  const { consumeDailyUsage } = await import("./daily-usage-limit");
  const result = await consumeDailyUsage(userId, feature, increment);
  return {
    current: result.current,
    limit: result.limit,
    remaining: result.remaining,
  };
}
