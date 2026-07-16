/**
 * Server-side login brute-force protection backed by Redis.
 * Complements client-only localStorage cooldown (which is easy to bypass).
 *
 * When Upstash is configured, counters are distributed across instances.
 * When Redis is unavailable, a process-local memory fallback still applies
 * so password stuffing is not completely open on a single server.
 */

import {
  isRedisConfigured,
  redisDel,
  redisGet,
  redisIncr,
  redisSet,
} from "@/lib/redis/client";
import {
  hashRedisIdentifier,
  loginFailureEmailKey,
  loginFailureIpKey,
} from "@/lib/redis/keys";
import { clampRedisTtl } from "@/lib/redis/ttl";

/** Stricter than client-only cooldowns: real credential stuffing resistance. */
const MAX_FAILURES_EMAIL = 5;
const MAX_FAILURES_IP = 20;
const LOCKOUT_WINDOW_SEC = 15 * 60; // 15 minutes
const LOCKOUT_WINDOW_MS = LOCKOUT_WINDOW_SEC * 1000;

export type LoginLockoutStatus = {
  locked: boolean;
  retryAfterSec: number;
  reason?: "email" | "ip";
  backend?: "redis" | "memory" | "none";
};

type MemoryBucket = { count: number; expiresAt: number };

const memoryEmailFails = new Map<string, MemoryBucket>();
const memoryIpFails = new Map<string, MemoryBucket>();

function parseCounter(raw: string | null): number {
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
}

function readMemoryBucket(map: Map<string, MemoryBucket>, key: string): MemoryBucket | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    map.delete(key);
    return null;
  }
  return entry;
}

function incrMemoryBucket(map: Map<string, MemoryBucket>, key: string): number {
  const now = Date.now();
  const existing = readMemoryBucket(map, key);
  if (!existing) {
    map.set(key, { count: 1, expiresAt: now + LOCKOUT_WINDOW_MS });
    return 1;
  }
  existing.count += 1;
  map.set(key, existing);
  return existing.count;
}

function memoryStatus(email: string, ip: string): LoginLockoutStatus {
  const emailKey = hashRedisIdentifier(email);
  const ipKey = hashRedisIdentifier(ip);
  const emailBucket = readMemoryBucket(memoryEmailFails, emailKey);
  const ipBucket = readMemoryBucket(memoryIpFails, ipKey);

  if (emailBucket && emailBucket.count >= MAX_FAILURES_EMAIL) {
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((emailBucket.expiresAt - Date.now()) / 1000)),
      reason: "email",
      backend: "memory",
    };
  }
  if (ipBucket && ipBucket.count >= MAX_FAILURES_IP) {
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((ipBucket.expiresAt - Date.now()) / 1000)),
      reason: "ip",
      backend: "memory",
    };
  }

  return { locked: false, retryAfterSec: 0, backend: "memory" };
}

export async function getLoginLockoutStatus(params: {
  email: string;
  ip: string;
}): Promise<LoginLockoutStatus> {
  if (!isRedisConfigured()) {
    return memoryStatus(params.email, params.ip);
  }

  const emailKey = loginFailureEmailKey(params.email);
  const ipKey = loginFailureIpKey(params.ip);

  const [emailRaw, ipRaw] = await Promise.all([
    redisGet(emailKey),
    redisGet(ipKey),
  ]);

  // Redis configured but unreachable (nulls + circuit open) → memory fallback.
  if (emailRaw === null && ipRaw === null) {
    // Still try Redis path first when values truly empty; memory is secondary.
    // If both null and Redis is configured, treat as zero failures (or memory if any).
    const mem = memoryStatus(params.email, params.ip);
    if (mem.locked) return mem;
  }

  const emailCount = parseCounter(emailRaw);
  const ipCount = parseCounter(ipRaw);

  if (emailCount >= MAX_FAILURES_EMAIL) {
    return {
      locked: true,
      retryAfterSec: LOCKOUT_WINDOW_SEC,
      reason: "email",
      backend: "redis",
    };
  }
  if (ipCount >= MAX_FAILURES_IP) {
    return {
      locked: true,
      retryAfterSec: LOCKOUT_WINDOW_SEC,
      reason: "ip",
      backend: "redis",
    };
  }

  return { locked: false, retryAfterSec: 0, backend: "redis" };
}

export async function recordLoginFailure(params: {
  email: string;
  ip: string;
}): Promise<LoginLockoutStatus> {
  if (!isRedisConfigured()) {
    const emailKey = hashRedisIdentifier(params.email);
    const ipKey = hashRedisIdentifier(params.ip);
    const e = incrMemoryBucket(memoryEmailFails, emailKey);
    const i = incrMemoryBucket(memoryIpFails, ipKey);

    if (e >= MAX_FAILURES_EMAIL) {
      return {
        locked: true,
        retryAfterSec: LOCKOUT_WINDOW_SEC,
        reason: "email",
        backend: "memory",
      };
    }
    if (i >= MAX_FAILURES_IP) {
      return {
        locked: true,
        retryAfterSec: LOCKOUT_WINDOW_SEC,
        reason: "ip",
        backend: "memory",
      };
    }
    return { locked: false, retryAfterSec: 0, backend: "memory" };
  }

  const ttl = clampRedisTtl(LOCKOUT_WINDOW_SEC);
  const emailKey = loginFailureEmailKey(params.email);
  const ipKey = loginFailureIpKey(params.ip);

  const [emailCount, ipCount] = await Promise.all([
    redisIncr(emailKey, ttl),
    redisIncr(ipKey, ttl),
  ]);

  // Redis incr returned null (circuit open / error) → memory fallback.
  if (emailCount === null && ipCount === null) {
    const emailMem = hashRedisIdentifier(params.email);
    const ipMem = hashRedisIdentifier(params.ip);
    const e = incrMemoryBucket(memoryEmailFails, emailMem);
    const i = incrMemoryBucket(memoryIpFails, ipMem);
    if (e >= MAX_FAILURES_EMAIL) {
      return {
        locked: true,
        retryAfterSec: LOCKOUT_WINDOW_SEC,
        reason: "email",
        backend: "memory",
      };
    }
    if (i >= MAX_FAILURES_IP) {
      return {
        locked: true,
        retryAfterSec: LOCKOUT_WINDOW_SEC,
        reason: "ip",
        backend: "memory",
      };
    }
    return { locked: false, retryAfterSec: 0, backend: "memory" };
  }

  const e = emailCount ?? 0;
  const i = ipCount ?? 0;

  if (e >= MAX_FAILURES_EMAIL) {
    // Ensure lockout window stays full length after threshold
    await redisSet(emailKey, String(e), ttl);
    return {
      locked: true,
      retryAfterSec: LOCKOUT_WINDOW_SEC,
      reason: "email",
      backend: "redis",
    };
  }
  if (i >= MAX_FAILURES_IP) {
    await redisSet(ipKey, String(i), ttl);
    return {
      locked: true,
      retryAfterSec: LOCKOUT_WINDOW_SEC,
      reason: "ip",
      backend: "redis",
    };
  }

  return { locked: false, retryAfterSec: 0, backend: "redis" };
}

export async function clearLoginFailures(params: {
  email: string;
  ip?: string;
}): Promise<void> {
  const emailMem = hashRedisIdentifier(params.email);
  memoryEmailFails.delete(emailMem);
  // Do not clear IP counter on single success - shared school NATs.

  if (!isRedisConfigured()) return;
  await redisDel(loginFailureEmailKey(params.email));
  if (params.ip) {
    void params.ip;
  }
}
