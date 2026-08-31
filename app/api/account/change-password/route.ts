import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { passwordSchema } from "@/lib/password-policy";
import { requireAal2ForSensitiveAuthAction } from "@/lib/auth-aal-guard";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export async function POST(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    // Enforce AAL2 for password change
    const aalGuard = await requireAal2ForSensitiveAuthAction({
      userId: actor.userId,
      sessionAccessToken: null, // Account portal auth doesn't expose access token here
    });
    if (!aalGuard.ok) return aalGuard.response;

    const rate = await applyPlatformRateLimit({
      scope: "account-change-password",
      schoolId: actor.schoolId,
      req,
      userId: actor.userId,
      preset: "heavyRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const body = await parseJsonWithSchema(req, changePasswordSchema);

    const profileResult = actor.profileId
      ? await supabaseAdmin
          .from("profiles")
          .select("email")
          .eq("id", actor.profileId)
          .eq("school_id", actor.schoolId)
          .maybeSingle()
      : await fetchProfileByIdentity(
          supabaseAdmin as never,
          actor.userId,
          "email",
          actor.email,
        );
    const { data: profile } = profileResult;

    if (!profile?.email) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: profile.email,
      password: body.currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 },
      );
    }

    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(actor.userId, {
        password: body.newPassword,
      });

    if (updateError) {
      console.error("[change-password] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to change password") },
      { status: 500 },
    );
  }
}
