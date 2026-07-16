import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  validateRequestSecurity,
} from "@/lib/server-guards";
import { emailService } from "@/lib/email";
import { getAppOrigin } from "@/lib/app-origin";
import { wrapEmailHtml, emailButton } from "@/lib/email-templates";
import { createResetToken } from "@/lib/stateless-token";
import { applyAuthApiRateLimit, authApiRateLimitResponse } from "@/lib/auth-api-rate-limit";

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/** Look up a user by email via the profiles table (indexed, fast).
 *  Returns { id, firstName } or null if not found. */
async function findUserByEmail(
  normalizedEmail: string,
): Promise<{ id: string; firstName: string } | null> {
  // 1. Try profiles table first (public schema, indexed)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profile) {
    return {
      id: profile.id,
      firstName: (profile.first_name as string) || "",
    };
  }

  // 2. Fallback: search auth.users directly (handles auth-only accounts)
  //    Uses a bounded scan - safe for school-scale user counts.
  const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 50,
  });

  const match = authUsers?.users?.find(
    (u) => u.email?.toLowerCase() === normalizedEmail,
  );

  if (match) {
    return {
      id: match.id,
      firstName: (match.user_metadata?.first_name as string) || "",
    };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const security = validateRequestSecurity(req);
    if (!security.valid) {
      return NextResponse.json({ error: security.error }, { status: 403 });
    }

    const rate = await applyAuthApiRateLimit({ scope: "forgotPassword", req });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const { email } = await parseJsonWithSchema(req, forgotPasswordSchema);
    const normalizedEmail = email.toLowerCase().trim();

    // Always return success to avoid email enumeration
    const successResponse = NextResponse.json({
      success: true,
      message:
        "If an account exists with that email, a password reset link has been sent.",
    });

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return successResponse;
    }

    // Create a stateless HMAC-signed reset token (no Redis/DB storage needed)
    const token = createResetToken(user.id);

    // Send reset email via custom SMTP (always - no Supabase fallback)
    const origin = getAppOrigin();
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;

    const greeting = user.firstName ? `Hello ${user.firstName},` : "Hello,";

    const html = wrapEmailHtml(
      `
      <p>${greeting}</p>
      <p>We received a request to reset your ZamSchool OS password.</p>
      ${emailButton(resetUrl, "Reset your password")}
      <p style="color:#64748b;font-size:14px">
        This link expires in 10 minutes. If you did not request a password reset,
        you can safely ignore this email.
      </p>
    `,
      "Password reset",
    );

    const text = [
      "ZamSchool OS - Password Reset",
      "",
      greeting,
      "",
      "We received a request to reset your password.",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 10 minutes.",
      "If you did not request this, ignore this email.",
    ].join("\n");

    const emailResult = await emailService.sendEmail({
      to: normalizedEmail,
      subject: "Reset your ZamSchool password",
      html,
      text,
    });

    if (!emailResult.success) {
      console.error("[forgot-password] Custom SMTP failed:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send reset email. Please try again later." },
        { status: 500 },
      );
    }

    console.log(
      `[forgot-password] Reset link sent to ${normalizedEmail} via custom SMTP`,
    );
    return successResponse;
  } catch (error: unknown) {
    console.error(
      "Forgot password error:",
      safeErrorMessage(error, "Unknown error"),
    );
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to process request") },
      { status: 500 },
    );
  }
}
