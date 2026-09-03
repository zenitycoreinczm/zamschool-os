import { fetchMiddlewareProfileRole } from "@/lib/middleware-profile-db";
import { normalizeRole, type KnownRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";

import { SUPABASE_PROTECTION } from "@/lib/supabase-protection";

/** Edge-safe (middleware cannot use TCP Redis). */
const ROLE_CACHE_TTL_MS = SUPABASE_PROTECTION.middlewareRoleTtlMs;
const ROLE_CACHE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const roleCache = new Map<
  string,
  { role: KnownRole | null; isActive: boolean; expiresAt: number }
>();

// Periodic cleanup to prevent unbounded memory growth in long-running processes.
// Expired entries are lazily skipped on read, but without cleanup they accumulate
// indefinitely for users who never return within the TTL window.
if (typeof window === "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of roleCache.entries()) {
      if (entry.expiresAt <= now) {
        roleCache.delete(key);
      }
    }
  }, ROLE_CACHE_CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (timer.unref) timer.unref();
}

export type MiddlewareProfileAccess = {
  role: ReturnType<typeof normalizeRole>;
  /** false when the profile was deactivated (removed from directory). */
  isActive: boolean;
};

export async function resolveMiddlewareProfileRole(
  userId: string,
  userEmail?: string | null
): Promise<MiddlewareProfileAccess> {
  const cached = roleCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return { role: cached.role, isActive: cached.isActive };
  }

  const fetched = await fetchMiddlewareProfileRole(
    supabaseAdmin as never,
    userId,
    userEmail
  );
  const entry = {
    role: normalizeRole(fetched.role),
    // Only an explicit is_active === false deactivates; DB errors default
    // to active so a transient profile-fetch failure cannot lock out a
    // whole school.
    isActive: fetched.isActive !== false,
    expiresAt: Date.now() + ROLE_CACHE_TTL_MS,
  };
  roleCache.set(userId, entry);
  return { role: entry.role, isActive: entry.isActive };
}

export function invalidateMiddlewareProfileRole(userId: string) {
  const id = String(userId || "").trim();
  if (!id) return;
  roleCache.delete(id);
}

export function resetMiddlewareProfileRoleCache() {
  roleCache.clear();
}
