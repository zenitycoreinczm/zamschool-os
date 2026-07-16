import { NextResponse } from "next/server";
import { z } from "zod";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { loadTeacherAccountDetail } from "@/lib/teacher-account-detail";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { ACCOUNT_PROFILE_ROLES } from "@/lib/account-profile-roles";
import { toProtectedAvatarUrl } from "@/lib/avatar-url";
import { invalidateActorCaches } from "@/lib/invalidate-actor-caches";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";

const updateProfileSchema = z.object({
  first_name: z.string().trim().max(120).optional().nullable(),
  last_name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ACCOUNT_PROFILE_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const isSuperAdmin =
      String(access.context.role || "").toUpperCase() === "SUPER_ADMIN";

    // Super admins may not have a school linked
    if (!access.context.schoolId && !isSuperAdmin) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    if (access.context.schoolId) {
      const rate = await applyPlatformRateLimit({
        scope: "account-profile-read",
        schoolId: access.context.schoolId,
        req,
        userId: access.context.userId,
        preset: "heavyRead",
      });
      if (!rate.allowed) return platformRateLimitResponse(rate);
    }

    const { data: profile, error: profileError } =
      await fetchProfileByIdentity<any>(
        supabaseAdmin as never,
        access.context.profileId || access.context.userId,
        "id, school_id, role, first_name, last_name, email, phone, address, avatar_url, is_active, class_id, must_change_password, temporary_password_issued_at, updated_at, created_at",
      );

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const normalizedRole = String(profile.role || access.context.role || "")
      .trim()
      .toUpperCase();
    const roleLower = normalizedRole.toLowerCase();
    const profileId =
      profile.id || access.context.profileId || access.context.userId;
    const schoolId = access.context.schoolId || profile.school_id || "";
    const teacher =
      normalizedRole === "TEACHER" && schoolId
        ? await loadTeacherAccountDetail({
            schoolId,
            profileId,
            baseProfile: {
              profileId: profile.id,
              role: roleLower,
              displayName: buildDisplayName(profile),
              email: profile.email || null,
              avatarUrl: toProtectedAvatarUrl(profile.avatar_url, {
                schoolId,
                userId: profileId,
              }),
              status: profile.is_active === false ? "INACTIVE" : "ACTIVE",
              updatedAt: profile.updated_at || profile.created_at || null,
            },
          })
        : null;

    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: {
          profile: {
            first_name: profile.first_name || "",
            last_name: profile.last_name || "",
            email: profile.email || "",
            phone: profile.phone || "",
            address: profile.address || "",
            avatar_url:
              toProtectedAvatarUrl(profile.avatar_url, {
                schoolId: schoolId,
                userId: profileId,
              }) || "",
            role: normalizedRole || access.context.role,
            class_id: profile.class_id || null,
            school_id: profile.school_id || access.context.schoolId || null,
            status: profile.is_active === false ? "INACTIVE" : "ACTIVE",
          },
          firstLogin: {
            mustChangePassword: profile.must_change_password === true,
            temporaryPasswordIssuedAt:
              profile.temporary_password_issued_at || null,
          },
          teacher: teacher,
        },
      }),
      "profileRead",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load profile") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ACCOUNT_PROFILE_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const isSuperAdmin =
      String(access.context.role || "").toUpperCase() === "SUPER_ADMIN";

    if (!access.context.schoolId && !isSuperAdmin) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const body = await parseJsonWithSchema(req, updateProfileSchema);
    const payload = compactRecord({
      first_name: normalizeOptionalString(body.first_name),
      last_name: normalizeOptionalString(body.last_name),
      email: normalizeOptionalString(body.email)?.toLowerCase() || null,
      phone: normalizeOptionalString(body.phone),
      address: normalizeOptionalString(body.address),
    });

    if (access.context.schoolId) {
      await updateOwnProfile(
        access.context.profileId || access.context.userId,
        access.context.userId,
        access.context.schoolId,
        payload,
      );
    } else {
      // Super admin without school - update by user id only
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(payload)
        .eq("id", access.context.profileId || access.context.userId);
      if (error) throw error;
      await invalidateActorCaches(access.context.userId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update profile") },
      { status: 500 },
    );
  }
}

async function updateOwnProfile(
  profileId: string,
  authUserId: string,
  schoolId: string,
  payload: Record<string, string | null>,
) {
  let working = { ...payload };

  for (let index = 0; index < 10; index += 1) {
    const remainingKeys = Object.keys(working).filter((k) => working[k] !== undefined);
    if (remainingKeys.length === 0) {
      throw new Error(
        "All requested profile fields map to missing database columns - no update was performed",
      );
    }

    const byProfileId = await supabaseAdmin
      .from("profiles")
      .update(working)
      .eq("id", profileId)
      .eq("school_id", schoolId)
      .select("id")
      .maybeSingle();

    if (!byProfileId.error && byProfileId.data?.id) {
      await invalidateActorCaches(authUserId);
      return;
    }

    const profileIdMissingColumn = extractMissingColumn(
      byProfileId.error?.message,
    );
    if (profileIdMissingColumn && profileIdMissingColumn in working) {
      console.warn(
        `[updateOwnProfile] Column "${profileIdMissingColumn}" missing from profiles table - dropping from update payload`,
      );
      delete working[profileIdMissingColumn];
      continue;
    }

    if (byProfileId.error) {
      throw byProfileId.error;
    }

    const byAuthUserId = await supabaseAdmin
      .from("profiles")
      .update(working)
      .eq("auth_user_id", authUserId)
      .eq("school_id", schoolId)
      .select("id")
      .maybeSingle();

    if (!byAuthUserId.error && byAuthUserId.data?.id) {
      await invalidateActorCaches(authUserId);
      return;
    }

    const authUserIdMissingColumn = extractMissingColumn(
      byAuthUserId.error?.message,
    );
    if (authUserIdMissingColumn && authUserIdMissingColumn in working) {
      console.warn(
        `[updateOwnProfile] Column "${authUserIdMissingColumn}" missing from profiles table - dropping from update payload`,
      );
      delete working[authUserIdMissingColumn];
      continue;
    }

    if (
      byAuthUserId.error &&
      !isMissingColumnError(byAuthUserId.error, "auth_user_id")
    ) {
      throw byAuthUserId.error;
    }

    throw new Error("Profile not found");
  }

  throw new Error("Failed to update profile");
}

function compactRecord(record: Record<string, string | null>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed : null;
}

function extractMissingColumn(message?: string) {
  if (!message) return null;
  const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
  if (postgrestMatch?.[1]) return postgrestMatch[1];

  const postgresMatch = message.match(/column "([^"]+)" does not exist/i);
  return postgresMatch?.[1] || null;
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
  column: string,
) {
  const message = String(error?.message || "");
  return (
    error?.code === "42703" ||
    message.includes(`column "${column}" does not exist`)
  );
}

function buildDisplayName(row: any) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.name ||
    row?.email ||
    "User"
  );
}
