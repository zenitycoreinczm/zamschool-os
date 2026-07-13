import { NextResponse } from "next/server";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { supabaseAdmin } from "@/lib/supabase";
import { getRoleDisplayLabel, normalizeRole } from "@/lib/roles";

export async function GET(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const rate = await applyPlatformRateLimit({
      scope: "account-session-read",
      schoolId: actor.schoolId,
      req,
      userId: actor.userId,
      preset: "heavyRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const columns =
      "id, email, role, first_name, last_name, school_id, last_login, created_at";
    const profileResult = actor.profileId
      ? await supabaseAdmin
          .from("profiles")
          .select(columns)
          .eq("id", actor.profileId)
          .eq("school_id", actor.schoolId)
          .maybeSingle()
      : await fetchProfileByIdentity(
          supabaseAdmin as never,
          actor.userId,
          columns,
          actor.email,
        );

    const { data: profile, error: profileError } = profileResult;

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found for this signed-in account" },
        { status: 404 },
      );
    }

    // Fetch school name
    let schoolName: string | null = null;
    if (profile.school_id) {
      const { data: school } = await supabaseAdmin
        .from("schools")
        .select("name")
        .eq("id", profile.school_id)
        .maybeSingle();
      schoolName = school?.name || null;
    }

    const role = normalizeRole(profile.role);
    const roleKey = role || profile.role || null;

    return NextResponse.json({
      success: true,
      data: {
        email: profile.email || null,
        role: roleKey,
        /** Human-readable role for UI (never show raw ACADEMIC_ADMIN etc.). */
        roleLabel: getRoleDisplayLabel(roleKey),
        schoolName,
        lastLogin: profile.last_login || profile.created_at || null,
        firstName: profile.first_name || null,
        lastName: profile.last_name || null,
      },
    });
  } catch (error: unknown) {
    const { logServerError, publicErrorBody } = await import("@/lib/safe-error");
    logServerError("account.session", error);
    // Never attach raw causes / column names to client responses.
    return NextResponse.json(publicErrorBody(error, "Failed to load session"), {
      status: 500,
    });
  }
}
