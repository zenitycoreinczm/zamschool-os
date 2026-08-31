import { NextResponse } from "next/server";
import { z } from "zod";

import { ACCOUNT_PROFILE_ROLES } from "@/lib/account-profile-roles";
import {
  AVATAR_MAX_INPUT_BYTES,
  processAndUploadAvatar,
} from "@/lib/avatar-storage";
import { invalidateActorCaches } from "@/lib/invalidate-actor-caches";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

const uploadAvatarSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.string().min(1).default("image/jpeg"),
});

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ACCOUNT_PROFILE_ROLES],
        requireSchool: false,
        
      },
      req,
    );
    if (!access.ok) return access.response;

    const body = await parseJsonWithSchema(req, uploadAvatarSchema);
    const bytes = Buffer.from(stripDataUrlPrefix(body.base64), "base64");

    if (!bytes.length) {
      return NextResponse.json(
        { error: "Avatar image is empty" },
        { status: 400 },
      );
    }

    if (bytes.length > AVATAR_MAX_INPUT_BYTES) {
      return NextResponse.json(
        { error: "Avatar image is too large. Use an image under 2MB." },
        { status: 400 },
      );
    }

    const schoolId = access.context.schoolId || "global";

    const profileId = access.context.profileId || access.context.userId;
    const {
      avatarUrl: protectedUrl,
      optimizedBytes,
      width,
      height,
    } = await processAndUploadAvatar({
      schoolId,
      userId: profileId,
      inputBuffer: bytes,
    });

    await persistAvatarUrl({
      profileId,
      authUserId: access.context.userId,
      schoolId: access.context.schoolId || null,
      avatarUrl: protectedUrl,
    });
    const avatarUrl = protectedUrl;
    if (access.context.schoolId) {
      await invalidateActorCaches(access.context.userId, access.context.schoolId);
      if (profileId && profileId !== access.context.userId) {
        await invalidateActorCaches(profileId, access.context.schoolId);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        avatarUrl,
        deliveryMode: "supabase",
        optimizedBytes,
        dimensions: { width, height },
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to upload avatar") },
      { status: 500 },
    );
  }
}

async function persistAvatarUrl(input: {
  profileId: string;
  authUserId: string;
  schoolId: string | null;
  avatarUrl: string;
}) {
  let query = supabaseAdmin
    .from("profiles")
    .update({ avatar_url: input.avatarUrl })
    .eq("id", input.profileId);
  if (input.schoolId) {
    query = query.eq("school_id", input.schoolId);
  }
  const byProfileId = await query.select("id").maybeSingle();

  if (!byProfileId.error && byProfileId.data?.id) {
    return;
  }

  if (byProfileId.error) {
    throw byProfileId.error;
  }

  let authQuery = supabaseAdmin
    .from("profiles")
    .update({ avatar_url: input.avatarUrl })
    .eq("auth_user_id", input.authUserId);
  if (input.schoolId) {
    authQuery = authQuery.eq("school_id", input.schoolId);
  }
  const byAuthUserId = await authQuery.select("id").maybeSingle();

  if (!byAuthUserId.error && byAuthUserId.data?.id) {
    return;
  }

  if (
    byAuthUserId.error &&
    !isMissingColumnError(byAuthUserId.error, "auth_user_id")
  ) {
    throw byAuthUserId.error;
  }

  throw new Error("Profile not found");
}

function stripDataUrlPrefix(value: string) {
  return String(value || "").replace(
    /^data:image\/[a-zA-Z0-9.+-]+;base64,/,
    "",
  );
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
