/**
 * Distributed IP reputation for data-center scale.
 * Temporary bans after scanner abuse / flood - backed by Upstash when available,
 * with process-local fallback so a single instance still defends itself.
 *
 * Ban durations ESCALATE: 1st offense 60s, 2nd 5 minutes, 3rd+ 5 hours (max).
 * The offense counter decays after the max window, so every network gets a
 * clean slate and comes back within 5 hours at the longest.
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
const memoryOffenses = new Map<string, { count: number; resetAt: number }>();

/**
 * Escalating ban schedule (seconds).
 *   1st offense -> 60s, 2nd -> 5 minutes, 3rd+ -> 5 hours (max).
 */
const BAN_ESCALATION_STEPS_SEC = [60, 5 * 60, 5 * 60 * 60] as const;

/** TTL for the offense (escalation memory) counter = max ban duration. */
const OFFENSE_TTL_SEC =
  BAN_ESCALATION_STEPS_SEC[BAN_ESCALATION_STEPS_SEC.length - 1];

/** Resolve the ban duration for the given offense count (1-based). */
export function resolveEscalatedBanTtlSec(offenseCount: number): number {
  const idx = Math.max(1, Math.floor(offenseCount)) - 1;
  const clamped = Math.min(idx, BAN_ESCALATION_STEPS_SEC.length - 1);
  return BAN_ESCALATION_STEPS_SEC[clamped];
}

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

/** Increment and return the escalating offense count (memory + Redis). */
async function incrementOffenseCount(ip: string): Promise<number> {
  const mk = memKey(ip);
  const now = Date.now();

  let count = 1;
  const entry = memoryOffenses.get(mk);
  if (entry && entry.resetAt > now) {
    entry.count += 1;
    entry.resetAt = now + OFFENSE_TTL_SEC * 1000;
    count = entry.count;
  } else {
    memoryOffenses.set(mk, {
      count: 1,
      resetAt: now + OFFENSE_TTL_SEC * 1000,
    });
  }

  if (isRedisConfigured()) {
    const redisCount = await redisIncr(
      `${ipAbuseRedisKey(ip)}:offense`,
      OFFENSE_TTL_SEC,
    );
    if (typeof redisCount === "number" && redisCount > 0) {
      count = redisCount;
      // Keep memory in sync with the authoritative Redis counter.
      memoryOffenses.set(mk, {
        count,
        resetAt: now + OFFENSE_TTL_SEC * 1000,
      });
    }
  }

  return count;
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

  // Value is the ban-expiry epoch ms; compute exact remaining seconds.
  const until = Number(raw);
  const remaining = Number.isFinite(until)
    ? Math.ceil((until - Date.now()) / 1000)
    : IP_BAN_TTL_SEC; // legacy/parsable-failure fallback
  if (remaining <= 0) return 0;

  // Memory cache the answer for a short window to spare Redis hits.
  writeMemoryBan(normalized, Math.min(remaining, 300));
  return remaining;
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
    // Value = ban-expiry epoch ms so getIpBanRemainingSec can report the
    // exact countdown (and the key itself expires at the same moment).
    await redisSet(
      ipBanRedisKey(normalized),
      String(Date.now() + ttl * 1000),
      ttl,
    );
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
    // Escalate: 1st ban 60s, 2nd 5min, 3rd+ 5h (max). Offense memory decays
    // after the max window so every network is fully unbanned within 5h.
    const offenseCount = await incrementOffenseCount(normalized);
    const ttl = resolveEscalatedBanTtlSec(offenseCount);
    await banIp(normalized, reason || "abuse_threshold", ttl);
    return { banned: true, count };
  }

  return { banned: false, count };
}

export async function clearIpBan(ip: string): Promise<void> {
  const normalized = String(ip || "").trim();
  if (!normalized) return;
  memoryBans.delete(memKey(normalized));
  memoryOffenses.delete(memKey(normalized));
  if (isRedisConfigured()) {
    await redisDel(ipBanRedisKey(normalized));
    // Also clear the escalation counter so a manually cleared IP starts
    // fresh at the lowest ban step.
    await redisDel(`${ipAbuseRedisKey(normalized)}:offense`);
  }
}
