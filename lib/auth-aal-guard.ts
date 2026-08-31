import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Enforce AAL2 for sensitive authentication actions (MFA unenroll, password change).
 * Returns a 403 response if the user has verified MFA factors but is only at AAL1.
 */
export async function requireAal2ForSensitiveAuthAction(input: {
  userId: string;
  sessionAccessToken?: string | null;
}): Promise<{ ok: true; response?: undefined } | { ok: false; response: NextResponse }> {
  const { userId, sessionAccessToken } = input;

  // Extract AAL from the JWT access token if provided
  let aal: string | null = null;
  if (sessionAccessToken) {
    try {
      const [, payloadB64] = sessionAccessToken.split(".");
      if (payloadB64) {
        const payload = JSON.parse(
          Buffer.from(payloadB64, "base64").toString("utf-8"),
        );
        aal = payload.aal || null;
      }
    } catch {
      // Ignore decode errors — fall through to factor check
    }
  }

  // If already at AAL2, allow immediately
  if (aal === "aal2") {
    return { ok: true };
  }

  // At AAL1 or unknown — check if user has any verified MFA factors
  const { data, error } = await supabaseAdmin.auth.mfa.listFactors();
  if (error) {
    console.error("[auth-aal-guard] Failed to list MFA factors:", error);
    // Fail open on admin API error — don't block legitimate users
    return { ok: true };
  }

  const hasVerifiedFactor =
    data?.all.some((factor) => factor.status === "verified") || false;

  if (hasVerifiedFactor) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Multi-factor authentication required. Please re-authenticate with your second factor." },
        { status: 403 },
      ),
    };
  }

  // No verified factors — allow at AAL1
  return { ok: true };
}
