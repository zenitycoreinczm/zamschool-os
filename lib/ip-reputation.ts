/**
 * Distributed IP reputation for data-center scale.
 * Temporary bans after scanner abuse / flood - backed by Upstash when available,
 * with process-local fallback so a single instance still defends itself.
 */

import {
  isRedisConfigured,
  redisGet,
  redisIncr,
  redisSet,
  redisDel,
} from "@/lib/redis/client";
import {
  IP_ABUSE_BAN_THRESHOLD,
  IP_ABUSE_WINDOW_SEC,
  IP_BAN_TTL_SEC,
  ipAbuseRedisKey,
  ipBanRedisKey,
  isIpOnStaticBlocklist,
} from "@/lib/server-security-policy";
import { isIpBanWorthyAbuseReason } from "@/lib/free-tier-guard";
import { clampRedisTtl } from "@/lib/redis/ttl";
import { hashRedisIdentifier } from "@/lib/redis/keys";

type MemoryBan = { until: number };

const memoryBans = new Map<string, MemoryBan>();
const memoryAbuse = new Map<string, { count: number; resetAt: number }>();

function memKey(ip: string) {
  return hashRedisIdentifier(ip);
}

function readMemoryBan(ip: string): number {
  const entry = memoryBans.get(memKey(ip));
  if (!entry) return 0;
  if (entry.until <= Date.now()) {
    memoryBans.delete(memKey(ip));
    return 0;
  }
  return Math.ceil((entry.until - Date.now()) / 1000);
}

function writeMemoryBan(ip: string, ttlSec: number) {
  memoryBans.set(memKey(ip), { until: Date.now() + ttlSec * 1000 });
}

/**
 * Returns remaining ban seconds (>0 if banned).
 */
export async function getIpBanRemainingSec(ip: string): Promise<number> {
  const normalized = String(ip || "").trim();
  if (!normalized || normalized === "unknown") return 0;

  if (isIpOnStaticBlocklist(normalized)) {
    return IP_BAN_TTL_SEC;
  }

  const mem = readMemoryBan(normalized);
  if (mem > 0) return mem;

  if (!isRedisConfigured()) return 0;

  const raw = await redisGet(ipBanRedisKey(normalized));
  if (!raw) return 0;
  // Value is "1" or remaining hint; treat any presence as banned for TTL window.
  writeMemoryBan(normalized, Math.min(IP_BAN_TTL_SEC, 300));
  return IP_BAN_TTL_SEC;
}

export async function banIp(
  ip: string,
  reason: string,
  ttlSec = IP_BAN_TTL_SEC,
): Promise<void> {
  const normalized = String(ip || "").trim();
  if (!normalized || normalized === "unknown") return;

  const ttl = clampRedisTtl(ttlSec);
  writeMemoryBan(normalized, ttl);

  if (isRedisConfigured()) {
    await redisSet(ipBanRedisKey(normalized), reason.slice(0, 80) || "abuse", ttl);
  }

  if (process.env.NODE_ENV !== "test") {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "security.ip_banned",
        ipHash: hashRedisIdentifier(normalized).slice(0, 16),
        reason: reason.slice(0, 80),
        ttlSec: ttl,
      }),
    );
  }
}

/**
 * Record an abuse event. Only scanner / hard bot reasons count toward auto-ban.
 * Flood and rate-limit 429s are ignored here so school NATs and login retries
 * never lock an entire campus IP for 1–2 hours.
 */
export async function recordIpAbuse(
  ip: string,
  reason: string,
): Promise<{ banned: boolean; count: number }> {
  const normalized = String(ip || "").trim();
  if (!normalized || normalized === "unknown") {
    return { banned: false, count: 0 };
  }

  // Soft signals (auth_flood, api_flood, page_flood, daily caps): do not ban.
  if (!isIpBanWorthyAbuseReason(reason)) {
    return { banned: false, count: 0 };
  }

  // Memory path
  const mk = memKey(normalized);
  const now = Date.now();
  let bucket = memoryAbuse.get(mk);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + IP_ABUSE_WINDOW_SEC * 1000 };
  }
  bucket.count += 1;
  memoryAbuse.set(mk, bucket);

  let count = bucket.count;

  if (isRedisConfigured()) {
    const redisCount = await redisIncr(
      ipAbuseRedisKey(normalized),
      IP_ABUSE_WINDOW_SEC,
    );
    if (typeof redisCount === "number" && redisCount > 0) {
      count = redisCount;
    }
  }

  if (count >= IP_ABUSE_BAN_THRESHOLD) {
    await banIp(normalized, reason || "abuse_threshold", IP_BAN_TTL_SEC);
    return { banned: true, count };
  }

  return { banned: false, count };
}

export async function clearIpBan(ip: string): Promise<void> {
  const normalized = String(ip || "").trim();
  if (!normalized) return;
  memoryBans.delete(memKey(normalized));
  if (isRedisConfigured()) {
    await redisDel(ipBanRedisKey(normalized));
  }
}
