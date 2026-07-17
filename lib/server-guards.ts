import { z } from "zod";
import { isRedisConfigured, redisSlidingWindowHit } from "./redis/client";
import { rateLimitKey } from "@/lib/redis/keys";
import {
  classifyClientBot,
  isBlockedAttackPath,
} from "@/lib/request-security";

export { safeErrorMessage } from "./safe-error";

interface RateBucketData {
  timestamps: number[];
  lastAccess: number;
}
interface LocalBypassData {
  expiresAt: number;
  remaining: number;
}
const memoryRateBuckets = new Map<string, RateBucketData>();
const localBypassBuckets = new Map<string, LocalBypassData>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Clean up every 5 minutes
const STALE_KEY_THRESHOLD_MS = 30 * 60 * 1000; // Remove keys unused for 30 minutes

// Set up periodic cleanup
let cleanupTimer: NodeJS.Timeout | undefined;
if (typeof window === "undefined") {
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, data] of memoryRateBuckets.entries()) {
      if (now - data.lastAccess > STALE_KEY_THRESHOLD_MS) {
        memoryRateBuckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (cleanupTimer.unref) cleanupTimer.unref();
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return req.headers.get("x-real-ip") || "unknown";
}

/** Prefer per-user keys for authenticated routes so shared IPs (school LAN, dev) do not block everyone. */
export function buildActorRateLimitKey(
  scope: string,
  req: Request,
  userId?: string | null,
) {
  const ip = getClientIp(req);
  if (userId) {
    return `${scope}:user:${userId}`;
  }
  return `${scope}:ip:${ip}`;
}

function checkMemoryRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucketKey = `rl:${key}`;
  const existing = memoryRateBuckets.get(bucketKey);
  const kept = (existing?.timestamps || []).filter(
    (timestamp) => timestamp > now - windowMs,
  );

  if (kept.length >= limit) {
    const oldest = kept[0] ?? now;
    // Update last access even if blocked so the key doesn't get cleaned up immediately
    memoryRateBuckets.set(bucketKey, { timestamps: kept, lastAccess: now });
    return {
      allowed: false as const,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  kept.push(now);
  memoryRateBuckets.set(bucketKey, { timestamps: kept, lastAccess: now });
  return { allowed: true as const };
}

export async function applyRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  failOpen?: boolean;
  localBypass?: {
    ttlMs: number;
    maxRequests: number;
  };
}) {
  if (isRedisConfigured()) {
    const now = Date.now();
    const bypassKey = `local-bypass:${params.key}`;

    if (params.localBypass) {
      const bypass = localBypassBuckets.get(bypassKey);
      if (bypass && bypass.expiresAt > now && bypass.remaining > 0) {
        bypass.remaining -= 1;
        localBypassBuckets.set(bypassKey, bypass);
        return { allowed: true as const };
      }
      if (bypass && bypass.expiresAt <= now) {
        localBypassBuckets.delete(bypassKey);
      }
    }

    try {
      const redisResult = await redisSlidingWindowHit({
        key: rateLimitKey("api", params.key),
        windowMs: params.windowMs,
        maxRequests: params.limit,
      });

      if (redisResult) {
        if (!redisResult.allowed) {
          return {
            allowed: false as const,
            retryAfterSec: Math.max(
              1,
              Math.ceil((redisResult.resetTime - now) / 1000),
            ),
          };
        }
        if (params.localBypass) {
          localBypassBuckets.set(bypassKey, {
            expiresAt: now + params.localBypass.ttlMs,
            remaining: Math.max(0, params.localBypass.maxRequests - 1),
          });
        }
        return { allowed: true as const };
      }
    } catch (error) {
      console.error(`[RateLimit] Redis error:`, error);
      if (params.failOpen) {
        return { allowed: true as const };
      }
      return { allowed: false as const, retryAfterSec: 60 };
    }

    /* Redis is configured but the call returned null (connection error, timeout, etc.).
       With failOpen: false, fail closed - deny the request. */
    if (!params.failOpen) {
      return { allowed: false as const, retryAfterSec: 60 };
    }
  }

  const result = checkMemoryRateLimit(
    params.key,
    params.limit,
    params.windowMs,
  );
  if (!result.allowed && params.failOpen) {
    return { allowed: true as const };
  }
  return result;
}

export async function parseJsonWithSchema<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<T> {
  try {
    const body = await req.json();
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid request data: ${error.issues.map((issue) => issue.message).join(", ")}`,
      );
    }
    throw error;
  }
}

/**
 * Reject empty / scanner user-agents and path probes on auth routes.
 * Does not replace CSRF or rate limits - first-line bot hygiene only.
 */
export function validateRequestSecurity(req: Request) {
  let pathname = "/";
  try {
    pathname = new URL(req.url).pathname;
  } catch {
    pathname = "/";
  }

  if (isBlockedAttackPath(pathname)) {
    return { valid: false as const, error: "Not found" };
  }

  const bot = classifyClientBot({
    userAgent: req.headers.get("user-agent"),
    pathname,
    method: req.method,
    authorization: req.headers.get("authorization"),
  });

  if (bot.block) {
    return {
      valid: false as const,
      error: "Request blocked",
    };
  }

  const userAgent = req.headers.get("user-agent") || "";
  // Trusted mobile okhttp may be short ("okhttp/4.9.2") — already allowed above when Bearer is set.
  if (!userAgent || userAgent.length < 8) {
    return { valid: false as const, error: "Invalid User-Agent" };
  }

  return { valid: true as const };
}
