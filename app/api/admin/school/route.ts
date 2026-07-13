import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import {
  requireAdminContext,
  requireAdminSetupContext,
} from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { auditDomainWrite } from "@/lib/audit-domain";

const updateSchoolSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(4).max(50),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  logoUrl: z.string().url().optional().nullable().or(z.literal("")),
  emisCode: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  schoolType: z.string().optional().nullable(),
  ownershipType: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminSetupContext(req);
    if (!access.ok) return access.response;
    const { userId } = access.context;

    const [{ data: profile, error: profileError }, authUserResult] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, school_id, first_name, last_name, email")
          .eq("id", userId)
          .maybeSingle(),
        supabaseAdmin.auth.admin.getUserById(userId),
      ]);

    if (profileError) throw profileError;

    const authUser = authUserResult.data.user;
    const headTeacherName = String(
      authUser?.user_metadata?.head_teacher_name ||
        authUser?.user_metadata?.admin_name ||
        authUser?.user_metadata?.full_name ||
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
        authUser?.email?.split("@")[0] ||
        "",
    ).trim();
    const setupUser = {
      id: userId,
      email: profile?.email || authUser?.email || null,
      emailConfirmed: Boolean(authUser?.email_confirmed_at),
      headTeacherName,
    };

    if (!profile?.school_id) {
      return applyEdgeCacheHeaders(
        NextResponse.json({
          success: true,
          data: {
            profile: profile || { id: userId, email: setupUser.email },
            school: null,
            auth: setupUser,
          },
        }),
        "schoolSettings",
      );
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select(
        "id, name, code, address, phone, email, logo_url, created_at, updated_at, emis_code, province, district, school_type, ownership_type, status",
      )
      .eq("id", profile.school_id)
      .single();

    if (schoolError) throw schoolError;

    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: { profile, school, auth: setupUser },
      }),
      "schoolSettings",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load school profile") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;

    // School identity is Head Teacher (or platform super admin) only.
    // HR manages staff/departments; they must not edit school profile fields.
    const actorRole = String(access.context.role || "").toUpperCase();
    if (actorRole !== "PRINCIPAL" && actorRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Only the Head Teacher can update school profile details. HR manages staff and departments instead.",
        },
        { status: 403 },
      );
    }

    const perm = await requireFeatureAccess(
      access.context,
      "settings",
      "update",
    );
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    const rate = await applyRateLimit({
      key: `admin-school:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateSchoolSchema);
    const payload = {
      name: body.name.trim(),
      code: body.code
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ""),
      address: cleanNullable(body.address),
      phone: cleanNullable(body.phone),
      email: cleanNullable(body.email),
      logo_url: cleanNullable(body.logoUrl),
      emis_code: cleanNullable(body.emisCode),
      province: cleanNullable(body.province),
      district: cleanNullable(body.district),
      school_type: cleanNullable(body.schoolType),
      ownership_type: cleanNullable(body.ownershipType),
    };

    if (payload.code.length < 4) {
      return NextResponse.json(
        { error: "Invalid school code" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .update(payload)
      .eq("id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "school.update",
      entityType: "school",
      entityId: schoolId,
      newData: payload,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update school profile") },
      { status: 500 },
    );
  }
}

function cleanNullable(value: string | null | undefined) {
  const cleaned = String(value || "").trim();
  return cleaned || null;
}
