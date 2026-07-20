import { dailyUsageKey } from "@/lib/redis/keys";
import {
  isRedisConfigured,
  redisGet,
  redisIncr,
  redisDecr,
} from "@/lib/redis/client";
import { clampRedisTtl } from "@/lib/redis/ttl";

const memoryDailyBuckets = new Map<string, number>();

export type DailyUsageResult = {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  retryAfterSec: number;
};

function todayUtcKey(): string {
  return new Date().toISOString().split("T")[0]!;
}

function secondsUntilUtcMidnight(): number {
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((tomorrow.getTime() - Date.now()) / 1000));
}

function resolveDailyMessageLimit(): number {
  const raw = Number(process.env.DAILY_MESSAGE_LIMIT ?? "5");
  if (!Number.isFinite(raw)) return 5;
  return Math.min(5, Math.max(3, Math.floor(raw)));
}

export function getDailyLimit(feature: string): number {
  // Free-tier defaults keep Upstash + Vercel + Supabase usage predictable.
  // Opt out with ZAMSCHOOL_FREE_TIER=false on paid plans.
  const freeTier =
    process.env.ZAMSCHOOL_FREE_TIER !== "false" &&
    (process.env.ZAMSCHOOL_FREE_TIER === "true" ||
      process.env.VERCEL_ENV === "production" ||
      process.env.NODE_ENV === "production");

  const limits: Record<string, number> = {
    messages_send: resolveDailyMessageLimit(),
    image_uploads: freeTier ? 20 : 50,
    file_upload: freeTier ? 20 : 50,
    exports: freeTier ? 3 : 10,
    announcements: freeTier ? 10 : 20,
    // Soft ceiling per user/day for expensive platform paths (not every API).
    api_calls: freeTier ? 2_000 : 10_000,
  };

  return limits[feature] ?? (freeTier ? 40 : 100);
}

function memoryBucketKey(feature: string, userId: string, day: string) {
  return `daily:${feature}:${userId}:${day}`;
}

function consumeMemoryDailyUsage(
  userId: string,
  feature: string,
  increment: number,
  limit: number,
): DailyUsageResult {
  const day = todayUtcKey();
  const key = memoryBucketKey(feature, userId, day);
  const next = (memoryDailyBuckets.get(key) || 0) + increment;

  if (next > limit) {
    return {
      allowed: false,
      current: memoryDailyBuckets.get(key) || 0,
      limit,
      remaining: 0,
      retryAfterSec: secondsUntilUtcMidnight(),
    };
  }

  memoryDailyBuckets.set(key, next);
  return {
    allowed: true,
    current: next,
    limit,
    remaining: Math.max(0, limit - next),
    retryAfterSec: secondsUntilUtcMidnight(),
  };
}

export async function getDailyUsage(
  userId: string,
  feature: string,
): Promise<DailyUsageResult> {
  const limit = getDailyLimit(feature);
  const day = todayUtcKey();
  const retryAfterSec = secondsUntilUtcMidnight();

  if (isRedisConfigured()) {
    const key = dailyUsageKey(feature, userId, day);
    const raw = await redisGet(key);
    const current = raw ? Number.parseInt(String(raw), 10) : 0;
    const safeCurrent = Number.isFinite(current) ? current : 0;
    const remaining = Math.max(0, limit - safeCurrent);
    return {
      allowed: remaining > 0,
      current: safeCurrent,
      limit,
      remaining,
      retryAfterSec,
    };
  }

  const current =
    memoryDailyBuckets.get(memoryBucketKey(feature, userId, day)) || 0;
  const remaining = Math.max(0, limit - current);
  return {
    allowed: remaining > 0,
    current,
    limit,
    remaining,
    retryAfterSec,
  };
}

export async function consumeDailyUsage(
  userId: string,
  feature: string,
  increment = 1,
): Promise<DailyUsageResult> {
  const limit = getDailyLimit(feature);
  const day = todayUtcKey();
  const retryAfterSec = secondsUntilUtcMidnight();

  if (isRedisConfigured()) {
    const key = dailyUsageKey(feature, userId, day);
    const current = await redisIncr(key, clampRedisTtl(retryAfterSec));

    if (current === null) {
      return consumeMemoryDailyUsage(userId, feature, increment, limit);
    }

    if (current > limit) {
      await redisDecr(key);
      return {
        allowed: false,
        current: Math.max(0, current - increment),
        limit,
        remaining: 0,
        retryAfterSec,
      };
    }

    return {
      allowed: true,
      current,
      limit,
      remaining: Math.max(0, limit - current),
      retryAfterSec,
    };
  }

  return consumeMemoryDailyUsage(userId, feature, increment, limit);
}
