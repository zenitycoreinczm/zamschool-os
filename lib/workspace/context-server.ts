import { buildAcademicContextLabel } from "@/lib/live-schema-adapters";
import {
  HOT_READ_TTL,
  hotReadKey,
  invalidateWorkspaceHotRead,
  withHotReadCache,
} from "@/lib/hot-read-cache";

export { invalidateWorkspaceHotRead };
import { getUnreadCountsForUser } from "@/lib/inbox/read-cache";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import type { ActorContext } from "@/lib/server-auth-core";
import { toProtectedAvatarUrl } from "@/lib/avatar-url";
import { supabaseAdmin } from "@/lib/supabase";
import { isRedisConfigured, redisGetJson, redisSetJson } from "@/lib/redis/client";
import { workspaceCacheKey } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";

export type WorkspaceContextPayload = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  role: string;
  workspaceRole: string;
  schoolId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  schoolName: string;
  yearTerm: string;
  unread: {
    messages: number;
    notifications: number;
  };
};

type AuthMeta = { email: string; emailConfirmed: boolean };

async function loadAuthMeta(userId: string): Promise<AuthMeta> {
  return withHotReadCache(
    hotReadKey(["auth-meta", `user:${userId}`]),
    HOT_READ_TTL.authMeta,
    async () => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
      return {
        email: data?.user?.email || "",
        emailConfirmed: Boolean(data?.user?.email_confirmed_at),
      };
    }
  );
}

type StableSlice = Omit<WorkspaceContextPayload, "unread">;

async function loadStableWorkspaceSlice(
  actor: ActorContext,
  authMeta: AuthMeta
): Promise<StableSlice> {
  // Try Redis first (persists across process restarts)
  const redisKey = workspaceCacheKey(actor.userId, actor.schoolId);
  if (isRedisConfigured()) {
    const cached = await redisGetJson<StableSlice>(redisKey);
    if (cached) {
      const roleLower = String(cached.role || "").toLowerCase();
      const hasSchool = Boolean(String(cached.schoolId || "").trim());
      // Ignore poisoned incomplete workspace entries.
      if (hasSchool || roleLower === "super_admin") {
        return cached;
      }
    }
  }

  // Fall through to in-memory hot-read cache → Supabase
  const result = await withHotReadCache(
    hotReadKey(["workspace", `user:${actor.userId}`, `school:${actor.schoolId || "none"}`]),
    HOT_READ_TTL.workspaceStable,
    async () => {
      const { data: profile, error: profileError } = await fetchProfileByIdentity<{
        id?: string;
        role?: string | null;
        school_id?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      }>(
        supabaseAdmin as never,
        actor.userId,
        "id, role, school_id, first_name, last_name, email, avatar_url",
        authMeta.email
      );

      if (profileError) {
        throw profileError;
      }

      const role = String(profile?.role || actor.role || "").trim();
      const schoolId = profile?.school_id || actor.schoolId || null;
      const email = profile?.email || authMeta.email || "";
      const firstName = profile?.first_name?.trim() || null;
      const lastName = profile?.last_name?.trim() || null;
      const displayName =
        [firstName, lastName].filter(Boolean).join(" ").trim() ||
        email ||
        "Your Account";

      let schoolName = "Your School";
      let yearTerm = "Academic Context";

      if (schoolId) {
        const [schoolResult, yearResult, termResult] = await Promise.all([
          supabaseAdmin.from("schools").select("name").eq("id", schoolId).maybeSingle(),
          supabaseAdmin
            .from("academic_years")
            .select("name")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .maybeSingle(),
          supabaseAdmin
            .from("terms")
            .select("name")
            .eq("school_id", schoolId)
            .eq("is_active", true)
            .maybeSingle(),
        ]);

        if (schoolResult.data?.name) {
          schoolName = schoolResult.data.name;
        }
        yearTerm = buildAcademicContextLabel(yearResult.data?.name, termResult.data?.name);
      }

      return {
        userId: actor.userId,
        email,
        emailConfirmed: authMeta.emailConfirmed,
        role,
        workspaceRole: role.toLowerCase(),
        schoolId,
        displayName,
        firstName,
        lastName,
        avatarUrl:
          schoolId && profile?.id
            ? toProtectedAvatarUrl(profile.avatar_url, {
                schoolId,
                userId: profile.id,
              })
            : null,
        schoolName,
        yearTerm,
      };
    }
  );

  // Cache in Redis only when school is resolved (or super-admin platform shell).
  // Caching schoolId:null under ":none" poisoned cold loads site-wide.
  const roleLower = String(result.role || "").toLowerCase();
  const canCacheWorkspace =
    Boolean(String(result.schoolId || "").trim()) ||
    roleLower === "super_admin";
  if (isRedisConfigured() && canCacheWorkspace) {
    void redisSetJson(redisKey, result, REDIS_TTL.workspaceSec);
  }

  return result;
}

export async function buildWorkspaceContextPayload(
  actor: ActorContext
): Promise<WorkspaceContextPayload> {
  // Parallelize expensive auth.admin + stable profile/school + unread counts.
  // Unread can use actor.schoolId immediately (same tenant as profile for 99% of cases).
  const schoolIdHint = actor.schoolId;
  const [authMeta, stable, unreadEarly] = await Promise.all([
    loadAuthMeta(actor.userId),
    loadStableWorkspaceSlice(actor, { email: "", emailConfirmed: false }),
    schoolIdHint
      ? getUnreadCountsForUser({
          userId: actor.userId,
          schoolId: schoolIdHint,
        })
      : Promise.resolve({ messages: 0, notifications: 0 }),
  ]);

  // If profile resolved a different school than actor cache, re-fetch unread once.
  let unread = unreadEarly;
  if (
    stable.schoolId &&
    stable.schoolId !== schoolIdHint
  ) {
    unread = await getUnreadCountsForUser({
      userId: actor.userId,
      schoolId: stable.schoolId,
    });
  } else if (!schoolIdHint && stable.schoolId) {
    unread = await getUnreadCountsForUser({
      userId: actor.userId,
      schoolId: stable.schoolId,
    });
  }

  return {
    ...stable,
    email: authMeta.email || stable.email,
    emailConfirmed: authMeta.emailConfirmed,
    unread,
  };
}