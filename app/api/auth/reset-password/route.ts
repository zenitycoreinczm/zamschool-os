import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  validateRequestSecurity,
} from "@/lib/server-guards";
import { verifyResetToken } from "@/lib/stateless-token";
import { passwordSchema } from "@/lib/password-policy";
import { applyAuthApiRateLimit, authApiRateLimitResponse } from "@/lib/auth-api-rate-limit";
import { maskEmail } from "@/lib/logger";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  email: z.string().email(),
  password: passwordSchema,
});

export async function POST(req: Request) {
  try {
    const security = validateRequestSecurity(req);
    if (!security.valid) {
      return NextResponse.json({ error: security.error }, { status: 403 });
    }

    const rate = await applyAuthApiRateLimit({ scope: "resetPassword", req });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const { token, email, password } = await parseJsonWithSchema(
      req,
      resetPasswordSchema,
    );
    const normalizedEmail = email.toLowerCase().trim();

    // Verify the stateless HMAC-signed token (no Redis/DB lookup needed)
    const payload = verifyResetToken(token);

    if (!payload) {
      return NextResponse.json(
        {
          error:
            "Reset link is invalid or has expired. Please request a new one.",
        },
        { status: 400 },
      );
    }

    // Cross-check: the user in the token must match the email
    const authUser = await supabaseAdmin.auth.admin.getUserById(payload.userId);
    if (
      authUser.error ||
      !authUser.data.user ||
      authUser.data.user.email?.toLowerCase() !== normalizedEmail
    ) {
      return NextResponse.json(
        { error: "Reset link is invalid. Please request a new one." },
        { status: 400 },
      );
    }

    // Update the password via admin API
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(payload.userId, {
        password,
        user_metadata: {
          ...authUser.data.user.user_metadata,
          must_change_password: false,
        },
      });

    if (updateError) {
      console.error(
        "[reset-password] Admin password update failed:",
        updateError.message,
      );
      return NextResponse.json(
        { error: "Failed to reset password. Please try again." },
        { status: 500 },
      );
    }

    console.log(
      `[reset-password] Password reset successful for ${maskEmail(normalizedEmail)}`,
    );
    return NextResponse.json({
      success: true,
      message: "Password has been reset. You can now sign in.",
    });
  } catch (error: unknown) {
    console.error(
      "Reset password error:",
      safeErrorMessage(error, "Unknown error"),
    );
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to reset password") },
      { status: 500 },
    );
  }
}
