/**
 * TTL defaults for Redis free tier (~25–30MB, allkeys-lru on the server).
 * Every Redis SET must use one of these — keys expire automatically.
 */

export const REDIS_TTL = {
  /** Sliding-window rate limit keys (pexpire = window length). */
  rateLimitWindowMs: 60_000,
  rateLimitBurstSec: 60,

  /** Role / permission cache (API routes). */
  roleSec: 15 * 60,

  /** Active session metadata (not Supabase JWT). 24h sliding refresh on touch. */
  sessionSec: 24 * 60 * 60,

  /** OTP send throttle per email. */
  otpThrottleSec: 60 * 60,

  /** Password reset / verify / invite token payloads. */
  tempTokenSec: 10 * 60,

  /** Daily usage counters (until UTC midnight). */
  dailyUsageMaxSec: 48 * 60 * 60,

  /** Consolidated shell response (workspace + unread + role shell). */
  shellSec: 120,

  /** Workspace context stable slice (school name, term, profile). */
  workspaceSec: 180,

  /**
   * School-wide dashboard metrics (student/teacher/class counts, attendance roll-up).
   * Shared across users in the school so reloads hit Redis, not Supabase.
   */
  schoolMetricsSec: 15 * 60,

  /**
   * Biweekly school backup snapshot (aggregate only). Auto-deletes after 7 days
   * so Upstash stays small; PDF is generated on download from this JSON.
   */
  schoolBackupSnapshotSec: 7 * 24 * 60 * 60,

  /** Hard cap for any application-chosen TTL. */
  maxKeySec: 30 * 24 * 60 * 60,
} as const;

export function clampRedisTtl(seconds: number): number {
  return Math.max(1, Math.min(Math.floor(seconds), REDIS_TTL.maxKeySec));
}
