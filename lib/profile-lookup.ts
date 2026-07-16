import { withCache, invalidateCache } from './enhanced-cache';

function isMissingColumnError(error: unknown, column: string) {
  const code = (error as { code?: string | null } | null | undefined)?.code;
  const message = String(
    (error as { message?: string | null } | null | undefined)?.message || ""
  );

  return code === "42703" || message.includes(`column "${column}" does not exist`);
}

export { profileIdentityOrFilter } from "@/lib/profile-identity";

/**
 * Sensitive column names that should never be cached.
 * If the requested `columns` string includes any of these,
 * the lookup bypasses the cache and always hits the database.
 */
const SENSITIVE_COLUMNS = ['role', 'password_hash', 'secret', 'token'];

function hasSensitiveColumns(columns: string): boolean {
  return SENSITIVE_COLUMNS.some((col) =>
    columns.split(',').map((c) => c.trim()).includes(col)
  );
}

/**
 * Perform the actual profile database lookups (3-step fallback).
 * Extracted so it can be used both directly and wrapped in a cache layer.
 */
async function fetchProfileFromDb<T = Record<string, unknown>>(
  client: any,
  userId: string,
  columns: string,
  userEmail?: string | null
): Promise<{ data: T | null; error: any }> {
  // 1. Look up by profile id (direct match - works when profile id === auth uid)
  const byId = await client
    .from("profiles")
    .select(columns)
    .eq("id", userId)
    .maybeSingle();

  if (byId.error) {
    return { data: null, error: byId.error };
  }

  if (byId.data) {
    return { data: byId.data as T, error: null };
  }

  // 2. Look up by auth_user_id (legacy link column)
  const byAuthUserId = await client
    .from("profiles")
    .select(columns)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (isMissingColumnError(byAuthUserId.error, "auth_user_id")) {
    return { data: null, error: null };
  }

  if (byAuthUserId.data) {
    return { data: byAuthUserId.data as T, error: null };
  }

  // 3. Final fallback: look up by email.
  // This handles admin/teacher accounts created without auth_user_id being set.
  // We also opportunistically set auth_user_id so future lookups succeed via path 2.
  if (userEmail) {
    const byEmail = await client
      .from("profiles")
      .select(columns)
      .eq("email", userEmail)
      .maybeSingle();

    if (!byEmail.error && byEmail.data) {
      // Link auth uid to this profile for future fast lookups
      await client
        .from("profiles")
        .update({ auth_user_id: userId })
        .eq("email", userEmail)
        .is("auth_user_id", null);
      return { data: byEmail.data as T, error: null };
    }
  }

  return {
    data: null,
    error: byAuthUserId.error || null,
  };
}

/**
 * Fetch a profile by identity with multi-layer caching.
 *
 * Caching is applied only when the requested `columns` exclude sensitive fields
 * (e.g. 'role', 'password_hash'). For sensitive lookups the database is always hit.
 *
 * Cache key pattern: `profile:{userId}:{columns}`
 * TTL: 300 s (5 min), stale-while-revalidate: 900 s
 */
export async function fetchProfileByIdentity<T = Record<string, unknown>>(
  client: any,
  userId: string,
  columns: string,
  userEmail?: string | null
): Promise<{ data: T | null; error: any }> {
  if (!userId) {
    return { data: null, error: null };
  }

  // Bypass cache when sensitive columns are requested
  if (hasSensitiveColumns(columns)) {
    return fetchProfileFromDb(client, userId, columns, userEmail);
  }

  // Cache-safe lookup with stale-while-revalidate
  const cacheKey = `${userId}:${columns}`;
  return withCache(
    cacheKey,
    () => fetchProfileFromDb(client, userId, columns, userEmail),
    {
      ttlSeconds: 300,
      staleWhileRevalidate: 900,
      tags: ['profile'],
    }
  );
}

export {
  invalidateActorCaches,
  invalidateActorCachesForProfile,
  invalidateProfileCache,
} from "@/lib/invalidate-actor-caches";
