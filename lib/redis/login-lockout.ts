/**
 * Server-side login brute-force protection backed by Redis.
 * Complements client-only localStorage cooldown (which is easy to bypass).
 *
 * Lockout policy (per security audit 2026-07-21):
 *  Email threshold : 3 failures → 60-second cooldown.
 *                    Each failure AFTER the cooldown doubles the window
 *                    (60 → 120 → 240 → 480 … up to LOCKOUT_WINDOW_SEC).
 *  IP hard-ban     : 4 cumulative IP-level failures → 24-hour ban.
 *                    Stored in a separate key so clearing email counter
 *                    on success does NOT lift an IP ban.
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

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Failures before the email-scoped cooldown kicks in. */
const MAX_FAILURES_EMAIL = 3;

/**
 * Failures from a single IP (across any accounts) before a hard 24-hour ban.
 * School NATs may share an IP — kept at 4 to balance security vs. collateral.
 */
const MAX_FAILURES_IP = 4;

/** Initial email-scoped cooldown after hitting MAX_FAILURES_EMAIL. */
const BASE_COOLDOWN_SEC = 60;

/** Maximum email-scoped cooldown (caps the doubling backoff). */
const MAX_COOLDOWN_SEC = 15 * 60; // 15 minutes

/** Hard IP-ban duration after MAX_FAILURES_IP cumulative failures. */
const IP_BAN_TTL_SEC = 24 * 60 * 60; // 24 hours

/** Window for counting email failures (resets counter if no failures). */
const LOCKOUT_WINDOW_SEC = MAX_COOLDOWN_SEC;
const LOCKOUT_WINDOW_MS = LOCKOUT_WINDOW_SEC * 1000;

// ─── Key helpers ──────────────────────────────────────────────────────────────

/** Separate key for hard IP ban (not cleared on email-success). */
function loginIpHardBanKey(ip: string): string {
  return `rl:login:ipban:${hashRedisIdentifier(ip)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoginLockoutStatus = {
  locked: boolean;
  retryAfterSec: number;
  reason?: "email" | "ip" | "ip-ban";
  backend?: "redis" | "memory" | "none";
};

type MemoryBucket = { count: number; expiresAt: number };

// ─── In-memory fallback (single instance only) ────────────────────────────────

const memoryEmailFails = new Map<string, MemoryBucket>();
const memoryIpFails = new Map<string, MemoryBucket>();
/** IP hard-ban: separate from sliding counter. */
const memoryIpBans = new Map<string, number>(); // key → expiresAt

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

/**
 * Compute the cooldown for a given failure count:
 *   count 3 → 60s, count 4 → 120s, count 5 → 240s … capped at MAX_COOLDOWN_SEC.
 */
function cooldownForCount(count: number): number {
  const extra = Math.max(0, count - MAX_FAILURES_EMAIL);
  return Math.min(BASE_COOLDOWN_SEC * Math.pow(2, extra), MAX_COOLDOWN_SEC);
}

function memoryStatus(email: string, ip: string): LoginLockoutStatus {
  const emailKey = hashRedisIdentifier(email);
  const ipKey = hashRedisIdentifier(ip);

  // Check IP hard-ban first.
  const banExpiry = memoryIpBans.get(ipKey);
  if (banExpiry) {
    const remaining = banExpiry - Date.now();
    if (remaining > 0) {
      return {
        locked: true,
        retryAfterSec: Math.ceil(remaining / 1000),
        reason: "ip-ban",
        backend: "memory",
      };
    }
    memoryIpBans.delete(ipKey);
  }

  const emailBucket = readMemoryBucket(memoryEmailFails, emailKey);
  const ipBucket = readMemoryBucket(memoryIpFails, ipKey);

  if (emailBucket && emailBucket.count >= MAX_FAILURES_EMAIL) {
    const cooldown = cooldownForCount(emailBucket.count);
    return {
      locked: true,
      retryAfterSec: cooldown,
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getLoginLockoutStatus(params: {
  email: string;
  ip: string;
}): Promise<LoginLockoutStatus> {
  if (!isRedisConfigured()) {
    return memoryStatus(params.email, params.ip);
  }

  const emailKey = loginFailureEmailKey(params.email);
  const ipKey = loginFailureIpKey(params.ip);
  const ipBanKey = loginIpHardBanKey(params.ip);

  const [emailRaw, ipRaw, ipBanRaw] = await Promise.all([
    redisGet(emailKey),
    redisGet(ipKey),
    redisGet(ipBanKey),
  ]);

  // IP hard-ban check (highest priority).
  if (ipBanRaw !== null && parseCounter(ipBanRaw) >= 1) {
    return {
      locked: true,
      retryAfterSec: IP_BAN_TTL_SEC,
      reason: "ip-ban",
      backend: "redis",
    };
  }

  // Redis configured but all values null → check memory as fallback.
  if (emailRaw === null && ipRaw === null) {
    const mem = memoryStatus(params.email, params.ip);
    if (mem.locked) return mem;
  }

  const emailCount = parseCounter(emailRaw);
  const ipCount = parseCounter(ipRaw);

  if (emailCount >= MAX_FAILURES_EMAIL) {
    return {
      locked: true,
      retryAfterSec: cooldownForCount(emailCount),
      reason: "email",
      backend: "redis",
    };
  }
  if (ipCount >= MAX_FAILURES_IP) {
    return {
      locked: true,
      retryAfterSec: IP_BAN_TTL_SEC,
      reason: "ip-ban",
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

    if (i >= MAX_FAILURES_IP) {
      // Hard-ban the IP in memory.
      memoryIpBans.set(ipKey, Date.now() + IP_BAN_TTL_SEC * 1000);
      return {
        locked: true,
        retryAfterSec: IP_BAN_TTL_SEC,
        reason: "ip-ban",
        backend: "memory",
      };
    }
    if (e >= MAX_FAILURES_EMAIL) {
      return {
        locked: true,
        retryAfterSec: cooldownForCount(e),
        reason: "email",
        backend: "memory",
      };
    }
    return { locked: false, retryAfterSec: 0, backend: "memory" };
  }

  const ttl = clampRedisTtl(LOCKOUT_WINDOW_SEC);
  const emailKey = loginFailureEmailKey(params.email);
  const ipKey = loginFailureIpKey(params.ip);
  const ipBanKey = loginIpHardBanKey(params.ip);

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
    if (i >= MAX_FAILURES_IP) {
      memoryIpBans.set(ipMem, Date.now() + IP_BAN_TTL_SEC * 1000);
      return {
        locked: true,
        retryAfterSec: IP_BAN_TTL_SEC,
        reason: "ip-ban",
        backend: "memory",
      };
    }
    if (e >= MAX_FAILURES_EMAIL) {
      return {
        locked: true,
        retryAfterSec: cooldownForCount(e),
        reason: "email",
        backend: "memory",
      };
    }
    return { locked: false, retryAfterSec: 0, backend: "memory" };
  }

  const e = emailCount ?? 0;
  const i = ipCount ?? 0;

  // IP hit hard-ban threshold → write a separate long-TTL ban key.
  if (i >= MAX_FAILURES_IP) {
    await redisSet(ipBanKey, "1", clampRedisTtl(IP_BAN_TTL_SEC));
    return {
      locked: true,
      retryAfterSec: IP_BAN_TTL_SEC,
      reason: "ip-ban",
      backend: "redis",
    };
  }

  if (e >= MAX_FAILURES_EMAIL) {
    const cooldown = cooldownForCount(e);
    // Refresh TTL to keep the window full-length during the cooldown period.
    await redisSet(emailKey, String(e), clampRedisTtl(cooldown));
    return {
      locked: true,
      retryAfterSec: cooldown,
      reason: "email",
      backend: "redis",
    };
  }

  return { locked: false, retryAfterSec: 0, backend: "redis" };
}

export async function clearLoginFailures(params: {
  email: string;
  ip?: string;
}): Promise<void> {
  // Clear email-scoped counter (successful login = reset for that account).
  const emailMem = hashRedisIdentifier(params.email);
  memoryEmailFails.delete(emailMem);
  // NOTE: IP counter and hard-ban are intentionally NOT cleared on a single
  // success — a school NAT behind one IP could otherwise wash the IP counter
  // by rotating through accounts. The IP ban expires naturally after 24 hours.

  if (!isRedisConfigured()) return;
  await redisDel(loginFailureEmailKey(params.email));
}
