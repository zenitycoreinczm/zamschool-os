import { NextResponse } from "next/server";

/**
 * In-memory cache only (per Node process). NOT backed by Redis.
 * Per free-tier policy: dashboards, profiles, and academic data stay here or in Supabase - not Redis.
 */

/**
 * Common cache tags for targeted invalidation.
 */
export type CacheTag =
  | "profile"
  | "attendance"
  | "students"
  | "classes"
  | "fees"
  | "announcements"
  | "dashboard"
  | "results";

export interface CacheConfig {
  ttlSeconds: number;
  staleWhileRevalidate?: number;
  tags?: CacheTag[];
}

export const CACHE_CONFIGS = {
  parent: {
    dashboard: { ttlSeconds: 45, staleWhileRevalidate: 120 },
    attendance: { ttlSeconds: 120, staleWhileRevalidate: 600 },
    progress: { ttlSeconds: 300, staleWhileRevalidate: 900 },
    fees: { ttlSeconds: 300, staleWhileRevalidate: 900 },
    children: { ttlSeconds: 600, staleWhileRevalidate: 1800 },
  },
  teacher: {
    bootstrap: { ttlSeconds: 90, staleWhileRevalidate: 300 },
    dashboard: { ttlSeconds: 90, staleWhileRevalidate: 300 },
    classes: { ttlSeconds: 300, staleWhileRevalidate: 900 },
    assignments: { ttlSeconds: 120, staleWhileRevalidate: 600 },
    attendance: { ttlSeconds: 60, staleWhileRevalidate: 300 },
    students: { ttlSeconds: 300, staleWhileRevalidate: 900 },
  },
  student: {
    dashboard: { ttlSeconds: 90, staleWhileRevalidate: 300 },
  },
  admin: {
    users: { ttlSeconds: 90, staleWhileRevalidate: 300 },
    analytics: { ttlSeconds: 300, staleWhileRevalidate: 900 },
    reports: { ttlSeconds: 600, staleWhileRevalidate: 1800 },
    settings: { ttlSeconds: 600, staleWhileRevalidate: 1800 },
    classes: { ttlSeconds: 60, staleWhileRevalidate: 180 },
  },
  shared: {
    announcements: { ttlSeconds: 120, staleWhileRevalidate: 600 },
    notices: { ttlSeconds: 120, staleWhileRevalidate: 600 },
    profile: { ttlSeconds: 300, staleWhileRevalidate: 900 },
  },
} as const;

type CacheEntry<T> = { data: T; timestamp: number; expiresAt: number };

const cacheStore = new Map<string, CacheEntry<unknown>>();
const staleMarkers = new Map<string, string>();

// Reverse index: tag → Set of cache keys. Enables O(1) tag-based invalidation
// instead of an O(n) full-scan over all keys.
const tagIndex = new Map<string, Set<string>>();

function indexKeyForTag(tag: string, cacheKey: string): void {
  let keys = tagIndex.get(tag);
  if (!keys) {
    keys = new Set();
    tagIndex.set(tag, keys);
  }
  keys.add(cacheKey);
}

function removeKeyFromTagIndex(cacheKey: string): void {
  for (const keys of tagIndex.values()) {
    keys.delete(cacheKey);
  }
}

function cacheGet<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    removeKeyFromTagIndex(key);
    return null;
  }
  return (entry as CacheEntry<T>).data;
}

function cacheGetWithMeta<T>(key: string): CacheEntry<T> | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    removeKeyFromTagIndex(key);
    return null;
  }
  return entry as CacheEntry<T>;
}

function cacheSet<T>(key: string, value: CacheEntry<T>, _ttlSeconds: number): void {
  // expiresAt is already embedded in the entry; no per-entry setTimeout needed.
  // The 60-second setInterval cleanup at the bottom of this file handles eviction.
  cacheStore.set(key, value);
}

function cacheDelete(key: string): void {
  cacheStore.delete(key);
  staleMarkers.delete(key);
  removeKeyFromTagIndex(key);
}

function cacheClearPattern(pattern: string): void {
  const needle = pattern.replace(/\*/g, "");
  for (const key of cacheStore.keys()) {
    if (key.includes(needle)) {
      cacheStore.delete(key);
      staleMarkers.delete(key);
      removeKeyFromTagIndex(key);
    }
  }
  for (const key of staleMarkers.keys()) {
    if (key.includes(needle)) {
      staleMarkers.delete(key);
    }
  }
}

/**
 * In-memory cache with stale-while-revalidate. Safe for server and client bundles.
 */
const inflightRequests = new Map<string, Promise<unknown>>();

export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
): Promise<T> {
  const tagPrefix = config.tags && config.tags.length > 0 ? `${config.tags[0]}:` : "";
  const cacheKey = `cache:${tagPrefix}${key}`;
  const staleKey = `stale:${tagPrefix}${key}`;

  try {
    const cached = cacheGetWithMeta<T>(cacheKey);

    if (cached) {
      const age = (Date.now() - cached.timestamp) / 1000;

      if (age < config.ttlSeconds) {
        return cached.data;
      }

      if (config.staleWhileRevalidate && age < config.ttlSeconds + config.staleWhileRevalidate) {
        void refreshCache(cacheKey, staleKey, fetchFn, config);
        return cached.data;
      }
    }

    if (staleMarkers.get(staleKey)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const recheck = cacheGetWithMeta<T>(cacheKey);
      if (recheck) return recheck.data;
    }

    const inflight = inflightRequests.get(cacheKey);
    if (inflight) {
      return inflight as Promise<T>;
    }

    const fetchPromise = fetchFn().then((data) => {
      const now = Date.now();
      const totalTtlMs = (config.ttlSeconds + (config.staleWhileRevalidate || 0)) * 1000;
      cacheSet(cacheKey, { data, timestamp: now, expiresAt: now + totalTtlMs }, config.ttlSeconds + (config.staleWhileRevalidate || 0));
      if (config.tags) config.tags.forEach((tag) => indexKeyForTag(tag, cacheKey));
      inflightRequests.delete(cacheKey);
      return data;
    }).catch((error) => {
      inflightRequests.delete(cacheKey);
      throw error;
    });

    inflightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  } catch (error) {
    console.error("[Cache] Error:", error);
    return fetchFn();
  }
}

async function refreshCache<T>(
  cacheKey: string,
  staleKey: string,
  fetchFn: () => Promise<T>,
  config: CacheConfig
): Promise<void> {
  try {
    staleMarkers.set(staleKey, "refreshing");
    const data = await fetchFn();
    const now = Date.now();
    const totalTtlMs = (config.ttlSeconds + (config.staleWhileRevalidate || 0)) * 1000;
    cacheSet(cacheKey, { data, timestamp: now, expiresAt: now + totalTtlMs }, config.ttlSeconds + (config.staleWhileRevalidate || 0));
    if (config.tags) config.tags.forEach((tag) => indexKeyForTag(tag, cacheKey));
    staleMarkers.delete(staleKey);
  } catch (error) {
    console.error("[Cache] Background refresh error:", error);
    staleMarkers.delete(staleKey);
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  cacheClearPattern(`cache:*${pattern}*`);
}

export async function invalidateCacheByTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    cacheClearPattern(`cache:*:${tag}:*`);
    cacheClearPattern(`cache:*:${tag}`);
  }
}

export async function invalidateByTag(tag: CacheTag): Promise<void> {
  // O(1) lookup via reverse index instead of O(n) full-scan.
  const keys = tagIndex.get(tag);
  if (keys) {
    for (const key of keys) {
      cacheStore.delete(key);
      staleMarkers.delete(key.replace(/^cache:/, "stale:"));
    }
    tagIndex.delete(tag);
  }
  // Also clear any stale markers that match the tag prefix (belt-and-suspenders).
  cacheClearPattern(`stale:${tag}:`);
}

export function withHttpCache(
  handler: (req: Request) => Promise<NextResponse>,
  config: CacheConfig
) {
  return async (req: Request): Promise<NextResponse> => {
    const response = await handler(req);

    const headerValue = config.staleWhileRevalidate
      ? `private, max-age=${config.ttlSeconds}, stale-while-revalidate=${config.staleWhileRevalidate}`
      : `private, max-age=${config.ttlSeconds}`;

    response.headers.set("Cache-Control", headerValue);
    response.headers.set("X-Cache-TTL", String(config.ttlSeconds));

    return response;
  };
}

export function generateUserCacheKey(
  userId: string,
  role: string,
  resource: string,
  params?: Record<string, string>
): string {
  const paramStr = params
    ? ":" +
      Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(":")
    : "";

  return `${role}:${userId}:${resource}${paramStr}`;
}

/**
 * withMultiLayerCache is now a thin wrapper over the unified cacheStore.
 * The separate memoryCache Map has been removed - cacheStore already serves
 * as the single in-memory layer, avoiding duplicate storage of the same data.
 */
export async function withMultiLayerCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  config: { memoryTTL: number; redisTTL?: number }
): Promise<T> {
  const ttlSeconds = config.memoryTTL || config.redisTTL || 300;
  return withCache(key, fetchFn, { ttlSeconds });
}

// Periodic eviction: remove expired entries from cacheStore and staleMarkers.
// This is the sole eviction mechanism - no per-entry setTimeout timers are used.
if (typeof window === "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of cacheStore.entries()) {
      if (entry.expiresAt <= now) {
        cacheStore.delete(key);
        staleMarkers.delete(key);
        removeKeyFromTagIndex(key);
      }
    }
  }, 60_000).unref?.();
}