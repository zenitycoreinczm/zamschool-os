/**
 * Upstash Redis (REST API) — server-only, approved use cases only.
 *
 * Web-app jobs Redis owns here:
 * - Rate limiting (atomic sliding window)
 * - Login brute-force lockouts
 * - Active session metadata (no JWT, no email PII)
 * - Role/school actor snapshots
 * - Shell + workspace bootstrap cache (short TTL)
 * - OTP throttle / temp tokens / email attestation
 * - Daily feature quotas
 *
 * DO NOT use for: dashboards, student lists, attendance, exam data, or general API caching.
 * See lib/redis/keys.ts, lib/supabase-protection.ts (TTL/dev-bucket policy), and .env.example.
 *
 * Uses @upstash/redis over HTTPS REST — no TCP pools (safe on Vercel serverless).
 * Every write must use a TTL (setex / EX / PEXPIRE / clampRedisTtl).
 */

import { isApprovedRedisKey } from "@/lib/redis/keys";
import { clampRedisTtl } from "@/lib/redis/ttl";

/* ─── Circuit Breaker ─── */
type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_COOLDOWN_MS = 30_000;
/** DNS / permanent host failures — stay open longer and log less. */
const CIRCUIT_COOLDOWN_DNS_MS = 5 * 60_000;
const LOG_THROTTLE_MS = 60_000;

let circuitState: CircuitState = "CLOSED";
let consecutiveFailures = 0;
let lastFailureTime = 0;
let lastLoggedErrorAt = 0;
let lastLoggedErrorKey = "";
let dnsFailureMode = false;
let lastOpenLogAt = 0;

function errorKey(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const e = err as {
    message?: string;
    code?: string;
    cause?: { code?: string; hostname?: string; message?: string };
  };
  return [
    e.code || "",
    e.cause?.code || "",
    e.cause?.hostname || "",
    e.message || e.cause?.message || "",
  ]
    .join("|")
    .slice(0, 160);
}

function isDnsOrHostUnreachableError(err: unknown): boolean {
  const key = errorKey(err).toLowerCase();
  return (
    key.includes("enotfound") ||
    key.includes("eai_again") ||
    key.includes("getaddrinfo") ||
    key.includes("name not resolved")
  );
}

function logRedisError(err: unknown) {
  const key = errorKey(err);
  const now = Date.now();
  if (key === lastLoggedErrorKey && now - lastLoggedErrorAt < LOG_THROTTLE_MS) {
    return;
  }
  lastLoggedErrorKey = key;
  lastLoggedErrorAt = now;
  console.error("[Redis] Operation error:", err);
}

function recordSuccess() {
  if (circuitState === "HALF_OPEN") {
    console.warn("[Redis] Circuit breaker: HALF_OPEN → CLOSED (recovered)");
    circuitState = "CLOSED";
    consecutiveFailures = 0;
    dnsFailureMode = false;
  } else if (consecutiveFailures > 0) {
    consecutiveFailures = 0;
    dnsFailureMode = false;
  }
}

function recordFailure(err?: unknown) {
  consecutiveFailures++;
  lastFailureTime = Date.now();
  if (err && isDnsOrHostUnreachableError(err)) {
    dnsFailureMode = true;
  }

  if (circuitState === "CLOSED" && consecutiveFailures >= CIRCUIT_THRESHOLD) {
    const now = Date.now();
    if (now - lastOpenLogAt > LOG_THROTTLE_MS) {
      console.warn(
        `[Redis] Circuit breaker: CLOSED → OPEN after ${consecutiveFailures} failures` +
          (dnsFailureMode ? " (DNS/host unreachable — long cooldown)" : ""),
      );
      lastOpenLogAt = now;
    }
    circuitState = "OPEN";
  } else if (circuitState === "HALF_OPEN") {
    circuitState = "OPEN";
  }
}

export function isRedisAvailable(): boolean {
  if (!isRedisConfigured()) return false;

  if (circuitState === "OPEN") {
    const cooldown = dnsFailureMode
      ? CIRCUIT_COOLDOWN_DNS_MS
      : CIRCUIT_COOLDOWN_MS;
    if (Date.now() - lastFailureTime >= cooldown) {
      const now = Date.now();
      if (now - lastOpenLogAt > LOG_THROTTLE_MS) {
        console.warn(
          "[Redis] Circuit breaker: OPEN → HALF_OPEN (testing recovery)",
        );
        lastOpenLogAt = now;
      }
      circuitState = "HALF_OPEN";
      consecutiveFailures = 0;
      return true;
    }
    return false;
  }

  return true;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL?.trim() &&
    process.env.UPSTASH_REDIS_REST_TOKEN?.trim(),
  );
}

let redisClient: import("@upstash/redis").Redis | null = null;

async function getRedisClient(): Promise<
  import("@upstash/redis").Redis | null
> {
  if (typeof window !== "undefined") return null;
  if (!isRedisConfigured()) return null;
  if (!isRedisAvailable()) return null;
  if (redisClient) return redisClient;

  try {
    const { Redis } = await import("@upstash/redis");
    // fromEnv() reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
    // Built-in: 5 retries with exponential backoff, auto-pipelining enabled
    redisClient = Redis.fromEnv();
    recordSuccess();
  } catch (err) {
    recordFailure(err);
    logRedisError(err);
    redisClient = null;
  }

  return redisClient;
}

function assertKey(key: string) {
  if (!isApprovedRedisKey(key)) {
    throw new Error(
      `[Redis] Key not allowed (free-tier policy): ${key.slice(0, 80)}`,
    );
  }
}

async function withCircuitBreaker<T>(
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (!isRedisAvailable()) return fallback;
  try {
    const result = await operation();
    recordSuccess();
    return result;
  } catch (err) {
    logRedisError(err);
    recordFailure(err);
    return fallback;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return null;
  return withCircuitBreaker(async () => {
    const val = await redis.get<string>(key);
    return val !== null && val !== undefined ? String(val) : null;
  }, null);
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return false;
  return withCircuitBreaker(async () => {
    await redis.setex(key, clampRedisTtl(ttlSeconds), value);
    return true;
  }, false);
}

export async function redisDel(key: string): Promise<void> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return;
  await withCircuitBreaker(() => redis.del(key).then(() => {}), undefined);
}

/** Get JSON — SDK auto-deserializes objects, arrays, numbers, booleans. */
export async function redisGetJson<T>(key: string): Promise<T | null> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return null;
  return withCircuitBreaker(async () => {
    const val = await redis.get<T>(key);
    return val ?? null;
  }, null);
}

/** Set JSON — SDK auto-serializes objects, arrays, numbers, booleans. */
export async function redisSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return false;
  return withCircuitBreaker(async () => {
    await redis.set(key, value, { ex: clampRedisTtl(ttlSeconds) });
    return true;
  }, false);
}

export async function redisIncr(
  key: string,
  ttlSeconds?: number,
): Promise<number | null> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return null;
  return withCircuitBreaker(async () => {
    const count = await redis.incr(key);
    if (count === 1 && ttlSeconds) {
      await redis.expire(key, clampRedisTtl(ttlSeconds));
    }
    return count;
  }, null);
}

export async function redisExpire(
  key: string,
  ttlSeconds: number,
): Promise<void> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return;
  await withCircuitBreaker(
    () => redis.expire(key, clampRedisTtl(ttlSeconds)).then(() => {}),
    undefined,
  );
}

/**
 * Atomic sliding-window rate limit (sorted set + Lua).
 * Single round-trip; safe under concurrent serverless invocations.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset = now + window
  if type(oldest) == 'table' and oldest[2] then
    reset = tonumber(oldest[2]) + window
  end
  return {0, 0, reset}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, max - count - 1, now + window}
`;

/** Sliding-window rate limit (sorted set) — atomic Upstash/Lua pattern. */
export async function redisSlidingWindowHit(params: {
  key: string;
  windowMs: number;
  maxRequests: number;
}): Promise<{ allowed: boolean; remaining: number; resetTime: number } | null> {
  assertKey(params.key);
  const redis = await getRedisClient();
  if (!redis) return null;

  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;

  return withCircuitBreaker(async () => {
    const raw = (await redis.eval(
      SLIDING_WINDOW_LUA,
      [params.key],
      [now, params.windowMs, params.maxRequests, member],
    )) as unknown;

    const tuple = Array.isArray(raw) ? raw : [];
    const allowedFlag = Number(tuple[0]);
    const remaining = Number(tuple[1]);
    const resetTime = Number(tuple[2]) || now + params.windowMs;

    return {
      allowed: allowedFlag === 1,
      remaining: Number.isFinite(remaining) ? Math.max(0, remaining) : 0,
      resetTime,
    };
  }, null);
}

/** Lightweight liveness for health checks / ops. */
export async function redisPing(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const redis = await getRedisClient();
  if (!redis) return false;
  return withCircuitBreaker(async () => {
    const pong = await redis.ping();
    return String(pong).toUpperCase() === "PONG";
  }, false);
}

export async function redisDecr(key: string): Promise<void> {
  assertKey(key);
  const redis = await getRedisClient();
  if (!redis) return;
  await withCircuitBreaker(() => redis.decr(key).then(() => {}), undefined);
}
