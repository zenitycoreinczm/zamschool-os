import { NextResponse } from "next/server";
import { z } from "zod";

import { auditDomainWrite } from "@/lib/audit-domain";
import { requireActorContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * ICT recovery: list / disable MFA (authenticator) factors for a school user.
 * After disable, the user signs in with email + password only and can re-enroll
 * 2FA from Settings.
 */
const MFA_RECOVERY_ROLES = ["ICT_ADMIN", "PRINCIPAL", "SUPER_ADMIN"] as const;

const disableSchema = z.object({
  profileId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...MFA_RECOVERY_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyRateLimit({
      key: `admin-users-mfa-read:${access.context.userId}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const { searchParams } = new URL(req.url);
    const profileId = String(searchParams.get("profileId") || "").trim();
    if (!profileId) {
      return NextResponse.json(
        { error: "profileId query parameter is required" },
        { status: 400 },
      );
    }

    const profile = await loadSchoolProfile(profileId, schoolId);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found in this school" },
        { status: 404 },
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: profileId,
    });
    if (error) throw error;

    const factors = (data?.factors || []).map((factor) => ({
      id: factor.id,
      factor_type: factor.factor_type,
      status: factor.status,
      friendly_name: factor.friendly_name || null,
      created_at: factor.created_at || null,
    }));

    const verifiedCount = factors.filter((f) => f.status === "verified").length;

    return NextResponse.json({
      success: true,
      data: {
        profileId,
        email: profile.email,
        role: profile.role,
        mfaEnabled: verifiedCount > 0,
        factorCount: factors.length,
        verifiedCount,
        factors,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load MFA status") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...MFA_RECOVERY_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-users-mfa-disable:${access.context.userId}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const body = await parseJsonWithSchema(req, disableSchema);
    const profileId = String(body.profileId || "").trim();

    const profile = await loadSchoolProfile(profileId, schoolId);
    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found in this school" },
        { status: 404 },
      );
    }

    // Do not let an ICT admin remove their own last recovery path mid-session
    // without awareness - still allow, but principals may reset anyone including ICT.
    // Super admins / principals / ICT may all disable for school users.

    const { data: listData, error: listError } =
      await supabaseAdmin.auth.admin.mfa.listFactors({
        userId: profileId,
      });
    if (listError) throw listError;

    const factors = listData?.factors || [];
    if (factors.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          profileId,
          email: profile.email,
          removedCount: 0,
          mfaEnabled: false,
          message: "Two-factor authentication was already disabled.",
        },
      });
    }

    const removedIds: string[] = [];
    for (const factor of factors) {
      const { error: deleteError } =
        await supabaseAdmin.auth.admin.mfa.deleteFactor({
          id: factor.id,
          userId: profileId,
        });
      if (deleteError) {
        throw deleteError;
      }
      removedIds.push(factor.id);
    }

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "users.mfa_disabled",
      entityType: "profile",
      entityId: profileId,
      newData: {
        email: profile.email,
        role: profile.role,
        removedFactorIds: removedIds,
        removedCount: removedIds.length,
        reason: "ict_recovery",
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      data: {
        profileId,
        email: profile.email,
        removedCount: removedIds.length,
        mfaEnabled: false,
        message:
          "Authenticator requirement removed. The user can sign in with email and password only, then re-enable 2FA in Settings.",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(
          error,
          "Failed to disable two-factor authentication",
        ),
      },
      { status: 500 },
    );
  }
}

async function loadSchoolProfile(profileId: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, school_id, role, email, first_name, last_name")
    .eq("id", profileId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: String(data.id),
    email: String(data.email || "").trim().toLowerCase() || null,
    role: String(data.role || "").trim().toLowerCase() || null,
  };
}
