import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { applyAuthApiRateLimit, authApiRateLimitResponse } from "@/lib/auth-api-rate-limit";
import { validateSchoolAccessCode } from "@/lib/school-access-code";
import { checkAccessCodeAttemptThrottle } from "@/lib/redis/temp";

const verifySchema = z.object({
  code: z.string().length(6, "Access code must be exactly 6 digits").regex(/^\d{6}$/, "Access code must be numeric"),
});

export async function POST(req: Request) {
  try {
    const rate = await applyAuthApiRateLimit({ scope: "verifyAccessCode", req });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const { code } = await parseJsonWithSchema(req, verifySchema);

    const throttled = !(await checkAccessCodeAttemptThrottle(code));
    if (throttled) {
      return NextResponse.json(
        { error: "Too many attempts for this access code. Please try again later." },
        { status: 429 },
      );
    }

    const validation = await validateSchoolAccessCode(code);

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    return NextResponse.json({
      success: true,
      message: "Access code verified successfully.",
      data: validation.scope,
    });
  } catch (err: unknown) {
    console.error("[verify-access-code] Error:", safeErrorMessage(err, "Unknown error"));
    return NextResponse.json({ error: safeErrorMessage(err, "Verification failed.") }, { status: 500 });
  }
}
