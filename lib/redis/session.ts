import {
  isRedisConfigured,
  redisDel,
  redisGetJson,
  redisSetJson,
} from "@/lib/redis/client";
import { sessionMetaKey } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";

/**
 * Small session metadata only — not a replacement for Supabase auth cookies.
 * Intentionally omits email / PII: use userId only; look up identity in Postgres.
 */
export type SessionMeta = {
  userId: string;
  lastSeenAt: number;
  /** Optional coarse client fingerprint (never store raw UA strings long-term). */
  uaHash?: string | null;
  schoolId?: string | null;
  role?: string | null;
};

const SESSION_META_TTL_SEC = REDIS_TTL.sessionSec;

export async function touchActiveSession(meta: SessionMeta): Promise<void> {
  if (!isRedisConfigured()) return;
  const userId = String(meta.userId || "").trim();
  if (!userId) return;

  await redisSetJson(
    sessionMetaKey(userId),
    {
      userId,
      lastSeenAt: Date.now(),
      uaHash: meta.uaHash ?? null,
      schoolId: meta.schoolId ?? null,
      role: meta.role ?? null,
    } satisfies SessionMeta,
    SESSION_META_TTL_SEC,
  );
}

export async function getActiveSessionMeta(
  userId: string,
): Promise<SessionMeta | null> {
  if (!isRedisConfigured()) return null;
  return redisGetJson<SessionMeta>(sessionMetaKey(userId));
}

/** Force-expire active session metadata (logout / account disable). */
export async function clearActiveSession(userId: string): Promise<void> {
  if (!isRedisConfigured()) return;
  const id = String(userId || "").trim();
  if (!id) return;
  await redisDel(sessionMetaKey(id));
}
