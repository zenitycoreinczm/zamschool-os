import type { SupabaseClient } from "@supabase/supabase-js";

import { invalidateCache } from "@/lib/enhanced-cache";
import { invalidateInboxHotReads } from "@/lib/inbox/read-cache";
import { invalidateMiddlewareProfileRole } from "@/lib/middleware-profile-cache";
import { invalidateWorkspaceHotRead } from "@/lib/workspace/context-server";
import { shellCacheKey, workspaceCacheKey } from "@/lib/redis/keys";

/** In-memory enhanced-cache entries for non-sensitive profile columns. */
export async function invalidateProfileCache(userId: string): Promise<void> {
  const id = String(userId || "").trim();
  if (!id) return;
  await invalidateCache(`profile:${id}:`);
}

/**
 * Node API routes only: profile cache + middleware role map + Redis actor snapshot.
 * Pass the Supabase auth user id when known.
 */
export async function invalidateActorCaches(authUserId: string): Promise<void> {
  const id = String(authUserId || "").trim();
  if (!id) return;

  await invalidateProfileCache(id);
  invalidateMiddlewareProfileRole(id);
  invalidateWorkspaceHotRead(id);
  invalidateInboxHotReads(id);

  const { invalidateRoleCache } = await import("@/lib/redis/role-cache");
  await invalidateRoleCache(id);

  const { redisDel } = await import("@/lib/redis/client");
  await Promise.all([
    redisDel(shellCacheKey(id, null)),
    redisDel(workspaceCacheKey(id, null)),
  ]);
}

/** Resolve profile id ↔ auth_user_id and invalidate all linked identity keys. */
export async function invalidateActorCachesForProfile(
  client: SupabaseClient,
  profileId: string,
): Promise<void> {
  const normalized = String(profileId || "").trim();
  if (!normalized) return;

  const ids = new Set<string>([normalized]);
  const { data } = await client
    .from("profiles")
    .select("id, auth_user_id, school_id")
    .eq("id", normalized)
    .maybeSingle();

  if (data?.id) ids.add(String(data.id));
  const authId = String(data?.auth_user_id || "").trim();
  if (authId) ids.add(authId);

  await Promise.all([...ids].map((id) => invalidateActorCaches(id)));

  const schoolId = String(
    (data as { school_id?: string | null } | null)?.school_id || "",
  ).trim();
  if (schoolId) {
    const { redisDel } = await import("@/lib/redis/client");
    await Promise.all(
      [...ids].flatMap((id) => [
        redisDel(shellCacheKey(id, schoolId)),
        redisDel(workspaceCacheKey(id, schoolId)),
      ]),
    );
    // Enrolment / role changes must refresh shared school counts.
    const { invalidateSchoolMetricsCache } = await import(
      "@/lib/school-metrics-cache"
    );
    await invalidateSchoolMetricsCache(schoolId);
  }
}

/** Call after class create/delete or bulk enrolment so dashboards refresh counts. */
export async function invalidateSchoolDashboardCaches(
  schoolId: string | null | undefined,
): Promise<void> {
  const id = String(schoolId || "").trim();
  if (!id) return;
  const { invalidateSchoolMetricsCache } = await import(
    "@/lib/school-metrics-cache"
  );
  const { invalidateByTag } = await import("@/lib/enhanced-cache");
  await Promise.all([
    invalidateSchoolMetricsCache(id),
    invalidateByTag("dashboard"),
    invalidateByTag("classes"),
    invalidateByTag("students"),
  ]);
}
