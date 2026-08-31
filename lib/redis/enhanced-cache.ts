/**
 * Enhanced Redis caching layer for 20K+ daily users.
 * Implements multi-level caching strategies to minimize Supabase load.
 *
 * Strategies:
 * 1. Read-through cache with automatic invalidation
 * 2. Write-behind cache for frequent updates
 * 3. Stale-while-revalidate for non-critical data
 * 4. Batch prefetching for related entities
 */

import { redisGetJson, redisSetJson, redisDel } from "@/lib/redis/client";
import { clampRedisTtl } from "@/lib/redis/ttl";

// Cache TTL presets (seconds)
const TTL = {
  // Critical user data - short TTL for freshness
  PROFILE: 300, // 5 minutes
  SCHOOL_CONTEXT: 600, // 10 minutes
  
  // Semi-static data - medium TTL
  CLASS_LIST: 900, // 15 minutes
  SUBJECT_LIST: 1800, // 30 minutes
  TERM_SCHEDULE: 3600, // 1 hour
  
  // Static reference data - long TTL
  GRADING_SCALES: 7200, // 2 hours
  ACADEMIC_YEARS: 86400, // 24 hours
  
  // Dashboard metrics - very short TTL
  DASHBOARD_SUMMARY: 120, // 2 minutes
  ATTENDANCE_STATS: 180, // 3 minutes
  
  // Feature flags & config
  FEATURE_FLAGS: 3600, // 1 hour
} as const;

type CacheKey = string;
type CacheValue = unknown;

interface CacheOptions {
  ttl: number;
  staleWhileRevalidate?: boolean;
  tags?: string[];
}

interface CachedEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

/**
 * Generate cache key with namespace isolation
 */
function cacheKey(namespace: string, ...parts: string[]): CacheKey {
  return `cache:${namespace}:${parts.filter(Boolean).join(":")}`;
}

/**
 * Multi-level get: Try Redis → Check staleness → Return if valid
 */
export async function cacheGet<T>(
  key: CacheKey,
  options?: { allowStale?: boolean },
): Promise<T | null> {
  const entry = await redisGetJson<CachedEntry<T>>(key);
  
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  const isExpired = age > entry.ttl * 1000;
  const isStale = age > entry.ttl * 1000 * 0.8; // 80% of TTL
  
  if (isExpired && !options?.allowStale) {
    await redisDel(key);
    return null;
  }
  
  // Return stale data in background while revalidating
  if (isStale && options?.allowStale) {
    // Trigger background revalidation (caller responsibility)
    console.warn(`[Cache] Stale data for ${key}, age=${Math.round(age / 1000)}s`);
  }
  
  return entry.data;
}

/**
 * Set cache entry with metadata
 */
export async function cacheSet<T>(
  key: CacheKey,
  data: T,
  options: CacheOptions,
): Promise<boolean> {
  const entry: CachedEntry<T> = {
    data,
    timestamp: Date.now(),
    ttl: options.ttl,
    tags: options.tags,
  };
  
  return redisSetJson(key, entry, clampRedisTtl(options.ttl));
}

/**
 * Delete cache entry and optionally invalidate by tags
 */
export async function cacheInvalidate(
  key: CacheKey,
  options?: { tags?: string[] },
): Promise<void> {
  await redisDel(key);
  
  // Tag-based invalidation would require a separate index
  // For now, we use key pattern matching via prefix
  if (options?.tags) {
    // Future: Implement tag index in sorted set
    console.warn("[Cache] Tag-based invalidation not yet implemented");
  }
}

/**
 * Read-through cache: Get from cache or fetch + cache
 */
export async function cacheReadThrough<T>(
  key: CacheKey,
  fetcher: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  
  // Fetch from source
  const data = await fetcher();
  
  // Cache the result
  await cacheSet(key, data, options);
  
  return data;
}

/**
 * Write-behind cache: Update cache immediately, persist later
 * Use for frequently updated but eventually consistent data
 */
export async function cacheWriteBehind<T>(
  key: CacheKey,
  data: T,
  options: CacheOptions,
  persister?: () => Promise<void>,
): Promise<void> {
  // Update cache immediately
  await cacheSet(key, data, options);
  
  // Persist asynchronously (fire-and-forget with error handling)
  if (persister) {
    persister().catch((err) => {
      console.error(`[Cache] Write-behind persistence failed for ${key}:`, err);
      // Invalidate cache on persistence failure to force refetch
      cacheInvalidate(key);
    });
  }
}

/**
 * Batch prefetch related entities
 * Reduces N+1 query patterns
 */
export async function cacheBatchPrefetch<T>(
  keys: CacheKey[],
  fetcher: (missingKeys: CacheKey[]) => Promise<Map<CacheKey, T>>,
  options: CacheOptions,
): Promise<Map<CacheKey, T>> {
  // Check which keys are missing from cache
  const results = new Map<CacheKey, T>();
  const missingKeys: CacheKey[] = [];
  
  for (const key of keys) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) {
      results.set(key, cached);
    } else {
      missingKeys.push(key);
    }
  }
  
  // Fetch missing entries in batch
  if (missingKeys.length > 0) {
    const fetched = await fetcher(missingKeys);
    
    // Cache all fetched entries
    for (const [key, data] of fetched) {
      await cacheSet(key, data, options);
      results.set(key, data);
    }
  }
  
  return results;
}

/**
 * Cache warming: Pre-populate cache for hot data
 * Call during deployment or off-peak hours
 */
export async function cacheWarm(
  entries: Array<{
    key: CacheKey;
    fetcher: () => Promise<unknown>;
    options: CacheOptions;
  }>,
): Promise<{ warmed: number; failed: number }> {
  let warmed = 0;
  let failed = 0;
  
  for (const entry of entries) {
    try {
      const data = await entry.fetcher();
      await cacheSet(entry.key, data, entry.options);
      warmed++;
    } catch (err) {
      console.error(`[Cache] Warming failed for ${entry.key}:`, err);
      failed++;
    }
  }
  
  return { warmed, failed };
}

/**
 * Cache statistics for monitoring
 */
export async function cacheStats(): Promise<{
  hitRate: number;
  totalEntries: number;
  memoryUsage: string;
}> {
  // This would require INFO command access
  // For now, return placeholder
  return {
    hitRate: 0, // Track via separate counter
    totalEntries: 0, // Would need KEYS command (expensive)
    memoryUsage: "unknown", // Would need INFO memory
  };
}

/**
 * Preset configurations for common use cases
 */
export const cachePresets = {
  userProfile: (userId: string) => ({
    key: cacheKey("user", "profile", userId),
    options: { ttl: TTL.PROFILE, tags: ["user", "profile"] },
  }),
  
  schoolContext: (schoolId: string) => ({
    key: cacheKey("school", "context", schoolId),
    options: { ttl: TTL.SCHOOL_CONTEXT, tags: ["school"] },
  }),
  
  classList: (schoolId: string) => ({
    key: cacheKey("school", "classes", schoolId),
    options: { ttl: TTL.CLASS_LIST, tags: ["school", "classes"] },
  }),
  
  dashboardSummary: (userId: string, role: string) => ({
    key: cacheKey("dashboard", "summary", userId, role),
    options: { ttl: TTL.DASHBOARD_SUMMARY, tags: ["dashboard"] },
  }),
  
  attendanceStats: (schoolId: string, date: string) => ({
    key: cacheKey("attendance", "stats", schoolId, date),
    options: { ttl: TTL.ATTENDANCE_STATS, tags: ["attendance"] },
  }),
  
  gradingScales: (schoolId: string) => ({
    key: cacheKey("school", "grading-scales", schoolId),
    options: { ttl: TTL.GRADING_SCALES, tags: ["grading"] },
  }),
};

/**
 * Invalidate all caches for a given scope
 * Use when bulk operations occur (e.g., term change, mass enrollment)
 */
export async function invalidateScope(scope: "user" | "school" | "global", id?: string): Promise<void> {
  // In production, this would use tag-based invalidation
  // For now, we rely on TTL expiration
  console.warn(`[Cache] Scope invalidation requested: ${scope}:${id || "all"}`);
  console.warn("[Cache] Consider implementing tag index for efficient invalidation");
}
