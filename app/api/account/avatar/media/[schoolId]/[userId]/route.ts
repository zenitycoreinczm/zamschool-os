import { NextResponse } from "next/server";

import { ACCOUNT_PROFILE_ROLES } from "@/lib/account-profile-roles";
import { AVATAR_BUCKET, buildAvatarObjectPath } from "@/lib/avatar-url";
import { resolveAvatarIdentity } from "@/lib/avatar-url";
import { applyRateLimit, safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteParams = {
  params: Promise<{ schoolId: string; userId: string }>;
};

export async function GET(req: Request, context: RouteParams) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ACCOUNT_PROFILE_ROLES],
        requireSchool: true,
      },
      req
    );
    if (!access.ok) return access.response;

    const { schoolId: schoolIdParam, userId: userIdParam } = await context.params;
    const schoolId = decodeURIComponent(schoolIdParam || "").trim();
    const userId = decodeURIComponent(userIdParam || "").trim();

    if (!schoolId || !userId) {
      return NextResponse.json({ error: "Invalid avatar path" }, { status: 400 });
    }

    if (!access.context.schoolId || access.context.schoolId !== schoolId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rate = await applyRateLimit({
      key: `avatar-media:${access.context.userId}:${userId}`,
      limit: 120,
      windowMs: 60_000,
      failOpen: true,
    });
    if (!rate.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Path segment may be profile.id (preferred) or auth_user_id (legacy).
    let target = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, avatar_url")
      .eq("id", userId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!target.data?.id) {
      target = await supabaseAdmin
        .from("profiles")
        .select("id, school_id, avatar_url")
        .eq("auth_user_id", userId)
        .eq("school_id", schoolId)
        .maybeSingle();
    }

    if (!target.data?.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const identity = resolveAvatarIdentity(target.data.avatar_url, {
      schoolId,
      userId: target.data.id,
    });
    const objectPath = buildAvatarObjectPath(identity.schoolId, identity.userId);

    const { data: blob, error: downloadError } = await supabaseAdmin.storage
      .from(AVATAR_BUCKET)
      .download(objectPath);

    if (downloadError || !blob) {
      return NextResponse.json({ error: "Avatar not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": blob.type || "image/webp",
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load avatar") },
      { status: 500 }
    );
  }
}