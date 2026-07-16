import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  validateRequestSecurity,
} from "@/lib/server-guards";
import {
  applyAuthApiRateLimit,
  authApiRateLimitResponse,
} from "@/lib/auth-api-rate-limit";
import { checkOtpSendThrottle } from "@/lib/redis/temp";
import {
  assertOtpRequestMatchesUser,
  OtpAuthError,
} from "@/lib/otp-request-auth";
import { emailService } from "@/lib/email";
import { REDIS_TTL } from "@/lib/redis/ttl";
import { storeOtpToken } from "@/lib/temp-token-store";
import crypto from "crypto";

const sendOtpSchema = z.object({
  email: z.string().email(),
  userId: z.string().uuid(),
});

/** Generate a cryptographically random 6-digit OTP. */
function generateOtp(): string {
  const buf = crypto.randomBytes(4);
  const num = buf.readUInt32BE(0) % 1_000_000;
  return num.toString().padStart(6, "0");
}

/** SHA-256 hash for OTP storage. */
function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function POST(req: Request) {
  try {
    const security = validateRequestSecurity(req);
    if (!security.valid) {
      return NextResponse.json({ error: security.error }, { status: 403 });
    }

    const { email, userId } = await parseJsonWithSchema(req, sendOtpSchema);
    const normalizedEmail = email.toLowerCase();

    await assertOtpRequestMatchesUser(req, userId);

    const target = await loadOtpTarget(userId, normalizedEmail);

    const rate = await applyAuthApiRateLimit({
      scope: "sendOtp",
      req,
      userId: target.userId,
    });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    if (!(await checkOtpSendThrottle(normalizedEmail))) {
      return NextResponse.json(
        { error: "Too many verification emails. Try again later." },
        { status: 429 },
      );
    }

    // Generate OTP, store hash in Redis (primary) or Postgres (fallback)
    const otp = generateOtp();
    const hashed = hashOtp(otp);
    const stored = await storeOtpToken(
      target.userId,
      hashed,
      REDIS_TTL.tempTokenSec,
    );

    if (!stored) {
      console.error(
        "[send-otp] Both Redis and Postgres unavailable - cannot store OTP",
      );
      return NextResponse.json(
        { error: "Unable to send verification email. Please try again later." },
        { status: 503 },
      );
    }

    // Send via custom SMTP (always - no Supabase fallback)
    const authUser = await supabaseAdmin.auth.admin.getUserById(target.userId);
    const userName =
      (authUser.data.user?.user_metadata?.first_name as string) || undefined;

    const emailResult = await emailService.sendOtpEmail(
      target.email,
      otp,
      userName,
    );

    if (!emailResult.success) {
      console.error("[send-otp] Custom SMTP failed:", emailResult.error);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500 },
      );
    }

    console.log(`[send-otp] OTP sent to ${maskEmail(target.email)} via custom SMTP`);
    return NextResponse.json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error: unknown) {
    if (error instanceof OtpAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("Send OTP error:", safeErrorMessage(error, "Unknown error"));
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to send OTP") },
      { status: 500 },
    );
  }
}

async function loadOtpTarget(userId: string, requestedEmail: string) {
  const lookup = await supabaseAdmin.auth.admin.getUserById(userId);
  const resolvedEmail = String(lookup.data.user?.email || "")
    .trim()
    .toLowerCase();

  if (
    lookup.error ||
    !lookup.data.user ||
    !resolvedEmail ||
    resolvedEmail !== requestedEmail
  ) {
    throw new Error("Invalid verification request");
  }

  return {
    userId: lookup.data.user.id,
    email: resolvedEmail,
  };
}

/** Mask an email for logging: "j***@example.com" */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local[0]}***@${domain}`;
}
