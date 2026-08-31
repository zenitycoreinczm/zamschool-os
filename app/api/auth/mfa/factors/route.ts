import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyAuthApiRateLimit, authApiRateLimitResponse } from "@/lib/auth-api-rate-limit";
import { requireAal2ForSensitiveAuthAction } from "@/lib/auth-aal-guard";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rate = await applyAuthApiRateLimit({
      scope: "mfaFactorsRead",
      req,
      userId: user.id,
    });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        factors: data?.all ?? [],
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to list MFA factors") },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Enforce AAL2 for MFA factor deletion
    const session = await supabase.auth.getSession();
    const aalGuard = await requireAal2ForSensitiveAuthAction({
      userId: user.id,
      sessionAccessToken: session.data.session?.access_token || null,
    });
    if (!aalGuard.ok) return aalGuard.response;

    const rate = await applyAuthApiRateLimit({
      scope: "mfaFactorsDelete",
      req,
      userId: user.id,
    });
    if (!rate.allowed) {
      return authApiRateLimitResponse(rate);
    }

    const { searchParams } = new URL(req.url);
    const factorId = searchParams.get("factorId");

    if (!factorId) {
      return NextResponse.json(
        { error: "factorId query parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to unenroll MFA factor") },
      { status: 500 }
    );
  }
}