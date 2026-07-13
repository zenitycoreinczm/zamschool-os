import { normalizeRole, type KnownRole } from "@/lib/roles";
import { roleCacheKey } from "@/lib/redis/keys";
import {
  isRedisConfigured,
  redisDel,
  redisGetJson,
  redisSetJson,
} from "@/lib/redis/client";
import { REDIS_TTL } from "@/lib/redis/ttl";

const ROLE_CACHE_TTL_SEC = REDIS_TTL.roleSec;
/** Process-local L1 — avoids 1–2s Supabase profile lookups on every API 403 path. */
const MEMORY_TTL_MS = Math.min(ROLE_CACHE_TTL_SEC * 1000, 2 * 60 * 1000);
const MEMORY_CLEANUP_MS = 5 * 60 * 1000;

export type CachedActorSnapshot = {
  role: KnownRole | null;
  schoolId: string | null;
  profileId?: string | null;
};

const memoryCache = new Map<
  string,
  { snapshot: CachedActorSnapshot; expiresAt: number }
>();

if (typeof window === "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryCache.entries()) {
      if (entry.expiresAt <= now) memoryCache.delete(key);
    }
  }, MEMORY_CLEANUP_MS);
  if (typeof timer.unref === "function") timer.unref();
}

function isCompleteActorSnapshot(
  snapshot: CachedActorSnapshot | null | undefined,
): snapshot is CachedActorSnapshot {
  if (!snapshot) return false;
  const profileId = String(snapshot.profileId || "").trim();
  if (!profileId) return false;
  const schoolId = String(snapshot.schoolId || "").trim();
  if (schoolId) return true;
  // Super admins may legitimately have no school.
  return snapshot.role === "SUPER_ADMIN";
}

function normalizeSnapshot(
  snapshot: CachedActorSnapshot,
): CachedActorSnapshot | null {
  const normalized: CachedActorSnapshot = {
    role: snapshot.role ?? null,
    schoolId: String(snapshot.schoolId || "").trim() || null,
    profileId: String(snapshot.profileId || "").trim() || null,
  };
  return isCompleteActorSnapshot(normalized) ? normalized : null;
}

function readMemory(userId: string): CachedActorSnapshot | null {
  const entry = memoryCache.get(userId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    memoryCache.delete(userId);
    return null;
  }
  return entry.snapshot;
}

function writeMemory(userId: string, snapshot: CachedActorSnapshot) {
  memoryCache.set(userId, {
    snapshot,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
}

function clearMemory(userId: string) {
  memoryCache.delete(userId);
}

/** Node.js API routes only — not for Edge middleware. */
export async function getCachedActorSnapshot(
  userId: string,
): Promise<CachedActorSnapshot | null> {
  const id = String(userId || "").trim();
  if (!id) return null;

  const fromMemory = readMemory(id);
  if (fromMemory) return fromMemory;

  if (!isRedisConfigured()) return null;

  const cached = await redisGetJson<CachedActorSnapshot>(roleCacheKey(id));
  if (!cached) return null;

  // Purge legacy/poisoned keys that stored schoolId:null for school-bound roles.
  // Those caused intermittent "No school linked" until TTL expired.
  const normalized = normalizeSnapshot(cached);
  if (!normalized) {
    await redisDel(roleCacheKey(id));
    return null;
  }

  writeMemory(id, normalized);
  return normalized;
}

export async function setCachedActorSnapshot(
  userId: string,
  snapshot: CachedActorSnapshot,
): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;

  const schoolId = String(snapshot.schoolId || "").trim() || null;
  const profileId = String(snapshot.profileId || "").trim() || null;
  const role = snapshot.role ?? null;
  const complete = normalizeSnapshot({ role, schoolId, profileId });

  // Incomplete snapshots (no school for school-bound roles) must not be cached —
  // they cause intermittent "No school linked" across every requireSchool route.
  if (!complete) {
    clearMemory(id);
    if (isRedisConfigured()) await redisDel(roleCacheKey(id));
    return;
  }

  writeMemory(id, complete);

  if (!isRedisConfigured()) return;

  await redisSetJson(roleCacheKey(id), complete, ROLE_CACHE_TTL_SEC);
}

export async function getCachedUserRole(
  userId: string,
): Promise<KnownRole | null> {
  const cached = await getCachedActorSnapshot(userId);
  return cached?.role ?? null;
}

export async function setCachedUserRole(
  userId: string,
  role: KnownRole | null,
): Promise<void> {
  const existing = (await getCachedActorSnapshot(userId)) ?? {
    role: null,
    schoolId: null,
  };
  await setCachedActorSnapshot(userId, { ...existing, role });
}

export async function invalidateRoleCache(userId: string): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;
  clearMemory(id);
  if (!isRedisConfigured()) return;
  await redisDel(roleCacheKey(id));
}

/** Test helper — clear process-local actor snapshots. */
export function resetActorSnapshotMemoryCache() {
  memoryCache.clear();
}
