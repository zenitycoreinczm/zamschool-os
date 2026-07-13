import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import {
  applyAuthApiRateLimit,
  authApiRateLimitResponse,
} from "@/lib/auth-api-rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  resolveVerifiedAuthUser,
  resolveVerifiedBearerUser,
} from "@/lib/supabase-auth-verify";
import { invalidateActorCaches } from "@/lib/invalidate-actor-caches";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { createAuditLog } from "@/lib/audit-log";
import { initializeSchoolDefaults } from "@/lib/school-initialization";
import {
  confirmEmailViaAdmin,
  consumeOtpVerificationAttestation,
  hasOtpVerificationAttestation,
} from "@/lib/principal-email-verified";
import {
  validateSchoolAccessCode,
  consumeSchoolAccessCode,
} from "@/lib/school-access-code";
import {
  normalizeOptionalZambianPhone,
  zambianPhoneValidationError,
} from "@/lib/zambia-localization";

function readBearerToken(req: Request) {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme || "") || !token) return "";
  return token.trim();
}

async function resolveRegistrationUser(req: Request) {
  const bearerToken = readBearerToken(req);
  if (bearerToken !== null) {
    if (!bearerToken) {
      return { user: null, error: new Error("Invalid authorization header") };
    }
    return resolveVerifiedBearerUser(supabaseAdmin.auth, bearerToken);
  }

  const supabase = await createClient();
  const { user, error } = await resolveVerifiedAuthUser(supabase);
  return { user, error };
}

const registerSchoolSchema = z
  .object({
    email: z.string().email(),
    schoolName: z.string().min(2).max(120),
    schoolCode: z.string().min(4).max(50),
    headTeacherName: z.string().min(2).max(120).optional(),
    /** @deprecated Use headTeacherName — kept for older registration clients */
    adminName: z.string().min(2).max(120).optional(),
    phone: z.string().max(40).optional().default(""),
    address: z.string().max(300).optional().default(""),
    logoUrl: z.string().url().optional().or(z.literal("")),
    emisCode: z.string().max(60).optional().default(""),
    province: z.string().max(120).optional().default(""),
    district: z.string().max(120).optional().default(""),
    schoolType: z.string().max(120).optional().default(""),
    ownershipType: z.string().max(120).optional().default(""),
    /** The 6-digit access code that was pre-verified on the frontend */
    accessCode: z
      .string()
      .length(6)
      .regex(/^\d{6}$/, "Invalid access code format"),
  })
  .superRefine((data, ctx) => {
    const name = String(data.headTeacherName || data.adminName || "").trim();
    if (name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Head Teacher name is required",
        path: ["headTeacherName"],
      });
    }
  });

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const auth = await resolveRegistrationUser(req);
    if (auth.error || !auth.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = auth.user.id;
    const rate = await applyAuthApiRateLimit({
      scope: "registerSchool",
      req,
      userId,
    });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const body = await parseJsonWithSchema(req, registerSchoolSchema);
    const {
      email,
      schoolName,
      schoolCode,
      phone,
      address,
      logoUrl,
      emisCode,
      province,
      district,
      schoolType,
      ownershipType,
      accessCode,
    } = body;
    const headTeacherName = String(
      body.headTeacherName || body.adminName || "",
    ).trim();

    const phoneError = zambianPhoneValidationError(phone);
    if (phoneError) {
      return NextResponse.json({ error: phoneError }, { status: 400 });
    }
    const normalizedPhone = normalizeOptionalZambianPhone(phone);

    if (!email || !schoolName || !schoolCode || !headTeacherName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const authUser = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authUser.error || !authUser.data.user) {
      return NextResponse.json(
        { error: "Authenticated user could not be verified." },
        { status: 401 },
      );
    }

    const authenticatedEmail = String(authUser.data.user.email || "")
      .trim()
      .toLowerCase();
    if (
      authenticatedEmail &&
      authenticatedEmail !== email.trim().toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Registration email must match the signed-in account." },
        { status: 400 },
      );
    }

    // Email must be verified before we create a school on the user's behalf.
    // Single source of truth: auth.users.email_confirmed_at. We try one
    // recovery path before returning 403, so a flaky SMTP delivery or
    // Supabase API hiccup during /verify-otp doesn't permanently strand
    // new principals:
    //   1. Self-heal via the post-OTP Redis attestation (set by verify-otp
    //      on each successful OTP match). Catches the "silent admin-API
    //      fail" case.
    //   2. Hard 403 with a clear hint.
    if (!authUser.data.user.email_confirmed_at) {
      const attested = await hasOtpVerificationAttestation(userId);
      if (attested) {
        try {
          await confirmEmailViaAdmin(supabaseAdmin, userId);
          await consumeOtpVerificationAttestation(userId);
          // Best-effort log so we can spot self-heal hits during the rollout.
          console.warn(
            "[register-school] self-healed email_confirmed_at for user",
            userId,
            "via OTP attestation",
          );
          // Re-fetch so the snapshot reflects the just-applied update.
          const refreshed = await supabaseAdmin.auth.admin.getUserById(userId);
          if (!refreshed.error && refreshed.data.user) {
            authUser.data.user = refreshed.data.user;
          }
        } catch (healErr) {
          console.error(
            "[register-school] self-heal email confirm failed:",
            safeErrorMessage(healErr, "unknown error"),
          );
        }
      }
    }

    if (!authUser.data.user.email_confirmed_at) {
      return NextResponse.json(
        {
          error:
            "Please verify your email before creating a school. If you just verified it, refresh the page and try again.",
        },
        { status: 403 },
      );
    }

    // ── 1. Validate the access code ─────────────────────────────────────────
    const codeValidation = await validateSchoolAccessCode(accessCode, {
      schoolDetails: { province, district, schoolType, ownershipType },
    });
    if (!codeValidation.ok) {
      return NextResponse.json(
        { error: codeValidation.error },
        { status: codeValidation.status },
      );
    }

    // ── 2. Check for existing school membership ──────────────────────────────
    const { data: existingProfile, error: existingProfileError } =
      await fetchProfileByIdentity<{
        id?: string;
        school_id?: string | null;
      }>(supabaseAdmin as any, userId, "id, school_id", email);

    if (existingProfileError) {
      console.error(
        "[register-school] profile lookup error:",
        existingProfileError,
      );
      return NextResponse.json(
        { error: "Could not verify existing profile." },
        { status: 500 },
      );
    }

    if (existingProfile?.school_id) {
      return NextResponse.json(
        { error: "This account already belongs to a school" },
        { status: 409 },
      );
    }

    // ── 3. Normalize school code ─────────────────────────────────────────────
    const normalizedCode = String(schoolCode || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 12);

    if (normalizedCode.length < 4) {
      return NextResponse.json(
        { error: "Invalid school code" },
        { status: 400 },
      );
    }

    let finalCode = normalizedCode;
    const { data: existing } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("code", finalCode)
      .maybeSingle();

    if (existing) {
      finalCode = `${normalizedCode.slice(0, 8)}${nanoid(4).toUpperCase()}`;
    }

    // ── 4. Create school ─────────────────────────────────────────────────────
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .insert({
        name: schoolName,
        code: finalCode,
        phone: normalizedPhone,
        email,
        address: address || null,
        logo_url: logoUrl || null,
        emis_code: emisCode || null,
        province: province || null,
        district: district || null,
        school_type: schoolType || null,
        ownership_type: ownershipType || null,
      })
      .select()
      .single();

    if (schoolError) throw schoolError;

    // ── 5. Update auth user metadata ─────────────────────────────────────────
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        school_id: school.id,
        role: "principal",
        head_teacher_name: headTeacherName,
        admin_name: headTeacherName,
      },
    });

    // ── 6. Create or link Head Teacher profile ───────────────────────────────
    const profilePayload = {
      school_id: school.id,
      role: "principal",
      first_name:
        headTeacherName.split(" ").slice(0, -1).join(" ") || headTeacherName,
      last_name: headTeacherName.split(" ").slice(-1).join(" ") || "",
      email,
      phone: normalizedPhone,
      auth_user_id: userId,
    };

    const profileError = existingProfile?.id
      ? (
          await supabaseAdmin
            .from("profiles")
            .update(profilePayload)
            .eq("id", existingProfile.id)
        ).error
      : (
          await supabaseAdmin.from("profiles").upsert(
            {
              id: userId,
              ...profilePayload,
            },
            { onConflict: "id" },
          )
        ).error;

    if (profileError) {
      const { logServerError } = await import("@/lib/safe-error");
      logServerError("register-school.profile", profileError, {
        schoolId: school.id,
      });
      await supabaseAdmin.from("schools").delete().eq("id", school.id);
      throw new Error("Failed to create Head Teacher profile");
    }

    await invalidateActorCaches(userId);

    const initialization = await initializeSchoolDefaults(school.id);

    // ── 7. Mark access code as used ──────────────────────────────────────────
    await consumeSchoolAccessCode(accessCode, email);

    await createAuditLog({
      schoolId: school.id,
      userId,
      action: "school.created",
      entityType: "school",
      entityId: school.id,
      newData: {
        code: finalCode,
        name: schoolName,
        access_code: accessCode,
        initialization,
      },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      schoolCode: finalCode,
      initialization,
    });
  } catch (error: unknown) {
    // Server log only — never echo SQL / schema / stack to the client.
    const { logServerError, publicErrorBody } = await import("@/lib/safe-error");
    logServerError("register-school", error);
    return NextResponse.json(
      publicErrorBody(
        error,
        "An unexpected error occurred during registration",
      ),
      { status: 500 },
    );
  }
}
