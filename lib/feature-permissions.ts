import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import {
  buildRolePermissionFallback,
  mergeFeaturePermission,
  type FeaturePerms,
} from "@/lib/permission-group-defaults";
import { normalizeRole, roleDatabaseValues, type KnownRole } from "@/lib/roles";

export type FeatureAction = "create" | "read" | "update" | "delete";

export type { FeaturePerms } from "@/lib/permission-group-defaults";

const ROLE_PERMISSION_FALLBACK = buildRolePermissionFallback();

interface SchoolDbCacheEntry {
  value: boolean | null;
  ts: number;
}

const schoolsWithDbPermissions = new Map<string, SchoolDbCacheEntry>();
const SCHOOLS_DB_CACHE_TTL_MS = 120_000; // 2 minutes

/* ── TTL cache for resolved role permissions ── */

// Short TTL so permission repairs (e.g. can_delete fixes) show up quickly in production.
const CACHE_TTL_MS = 15_000;

interface CacheEntry {
  value: Record<string, FeaturePerms>;
  ts: number; // Date.now() when stored
}

const permCache = new Map<string, CacheEntry>();

const DEBUG = !!process.env.DEBUG;

function cacheKey(schoolId: string, role: string): string {
  return `${schoolId}:${role}`;
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.ts < CACHE_TTL_MS;
}

/** Clear cached permissions. If schoolId is given, only that school's entries are removed. */
export function clearPermissionCache(schoolId?: string) {
  if (!schoolId) {
    permCache.clear();
    return;
  }
  for (const key of permCache.keys()) {
    if (key.startsWith(`${schoolId}:`)) {
      permCache.delete(key);
    }
  }
}

/** True when the school has permission_groups (seeded or customized). */
async function schoolUsesDbPermissions(schoolId: string): Promise<boolean | null> {
  const cached = schoolsWithDbPermissions.get(schoolId);
  if (cached && Date.now() - cached.ts < SCHOOLS_DB_CACHE_TTL_MS) {
    return cached.value;
  }

  const { count, error } = await supabaseAdmin
    .from("permission_groups")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (error) {
    console.error(
      "[feature-permissions] permission_groups lookup failed",
      error.message,
    );
    const fallbackValue = cached ? cached.value : null;
    schoolsWithDbPermissions.set(schoolId, { value: fallbackValue, ts: Date.now() });
    return fallbackValue;
  }

  const usesDb = (count ?? 0) > 0;
  schoolsWithDbPermissions.set(schoolId, { value: usesDb, ts: Date.now() });
  return usesDb;
}

/**
 * Load aggregated feature permissions for a role within a school.
 * Queries permission_group_roles -> permission_features chain.
 */
async function resolveRolePermissions(schoolId: string, role: string) {
  const roleValues = roleDatabaseValues(role);
  if (roleValues.length === 0) return {};

  const key = cacheKey(schoolId, role);
  const cached = permCache.get(key);
  if (cached && isFresh(cached)) {
    if (DEBUG) console.debug(`[feature-permissions] cache HIT  ${key}`);
    return cached.value;
  }
  if (DEBUG) console.debug(`[feature-permissions] cache MISS ${key}`);

  try {
    const { data: groupRoles } = await supabaseAdmin
      .from("permission_group_roles")
      .select("group_id")
      .eq("school_id", schoolId)
      .in("role", roleValues);

    if (!groupRoles || groupRoles.length === 0) {
      permCache.set(key, { value: {}, ts: Date.now() });
      return {};
    }

    const groupIds = groupRoles.map((r: { group_id: string }) => r.group_id);

    const { data: features } = await supabaseAdmin
      .from("permission_features")
      .select(
        "feature_key, can_create, can_read, can_update, can_delete, scope",
      )
      .eq("school_id", schoolId)
      .in("group_id", groupIds);

    const result: Record<string, FeaturePerms> = {};

    for (const f of features || []) {
      result[f.feature_key] = mergeFeaturePermission(result[f.feature_key], {
        can_create: f.can_create,
        can_read: f.can_read,
        can_update: f.can_update,
        can_delete: f.can_delete,
        scope: f.scope,
      });
    }

    permCache.set(key, { value: result, ts: Date.now() });
    return result;
  } catch (err) {
    // Stale-on-error: return expired cache if available, otherwise empty
    if (cached) {
      console.error(
        `[feature-permissions] DB error, returning stale cache for ${key}`,
        err,
      );
      return cached.value;
    }
    console.error(`[feature-permissions] DB error, no cache for ${key}`, err);
    return {};
  }
}

/**
 * Check if a user has permission for a specific feature action.
 * SUPER_ADMIN bypasses all feature-level checks.
 *
 * When permission_features exist for the school, only DB-backed group
 * permissions apply. Legacy hardcoded defaults are used only for schools
 * that have not been seeded with permission groups yet.
 */
export async function checkFeaturePermission(
  context: { schoolId: string | null; role: string },
  feature: string,
  action: FeatureAction,
): Promise<boolean> {
  const normalizedRole = normalizeRole(context.role);
  if (normalizedRole === "SUPER_ADMIN") return true;
  if (!context.schoolId) return false;
  if (!normalizedRole) return false;

  const [permissions, usesDb] = await Promise.all([
    resolveRolePermissions(context.schoolId, context.role),
    schoolUsesDbPermissions(context.schoolId),
  ]);

  const featurePerms =
    permissions[feature] ??
    (usesDb === false
      ? ROLE_PERMISSION_FALLBACK[normalizedRole as KnownRole]?.[feature]
      : undefined);

  if (!featurePerms) return false;

  switch (action) {
    case "create":
      return featurePerms.can_create;
    case "read":
      return featurePerms.can_read;
    case "update":
      return featurePerms.can_update;
    case "delete":
      return featurePerms.can_delete;
  }
}

/**
 * Auth guard extension: check feature access after authentication.
 * Returns 403 response if the user lacks the required feature permission.
 *
 * Usage:
 *   const access = await requireAdminContext(req);
 *   if (!access.ok) return access.response;
 *   const perm = await requireFeatureAccess(access.context, "users", "read");
 *   if (!perm.ok) return perm.response;
 */
export async function requireFeatureAccess(
  context: { schoolId: string | null; role: string },
  feature: string,
  action: FeatureAction,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const allowed = await checkFeaturePermission(context, feature, action);
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Insufficient permissions to ${action} ${feature}` },
        { status: 403 },
      ),
    };
  }
  return { ok: true };
}

/** Invalidate cached DB-permission flag after permission group mutations. */
export function invalidateSchoolPermissionCache(schoolId: string) {
  schoolsWithDbPermissions.delete(schoolId);
  clearPermissionCache(schoolId);
}
