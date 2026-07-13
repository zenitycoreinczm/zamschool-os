import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { feeSchema } from "@/lib/payment-input";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { requirePaymentsContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";
import { getClientIp } from "@/lib/server-guards";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "payments.fees" });

export async function GET(request: NextRequest) {
  try {
    const access = await requirePaymentsContext(request);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "payments", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    let query = supabaseAdmin
      .from("fees")
      .select(
        "id, school_id, name, description, amount, currency, frequency, is_active, created_at, updated_at",
      )
      .eq("school_id", schoolId);

    if (active === "true") {
      query = query.eq("is_active", true);
    }

    const { data: fees, error: feesError } = await query.order("created_at", {
      ascending: false,
    });

    if (feesError) {
      log.error("fees.fetch_failed", { schoolId, error: feesError });
      return NextResponse.json(
        { error: "Failed to fetch fees" },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: fees || [] });
  } catch (error) {
    log.error("fees.get_unexpected", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentsContext(request);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "payments",
      "create",
    );
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;

    const body = await request.json();
    const payload = feeSchema.parse(body);

    const { data: newFee, error: feeError } = await supabaseAdmin
      .from("fees")
      .insert({
        school_id: schoolId,
        name: payload.name,
        description: payload.description,
        amount: payload.amount,
        currency: payload.currency,
        frequency: payload.frequency,
        created_by: userId,
      })
      .select()
      .single();

    if (feeError) {
      log.error("fees.create_failed", { schoolId, error: feeError });
      return NextResponse.json(
        { error: "Failed to create fee" },
        { status: 500 },
      );
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "fee.created",
      entityType: "fees",
      entityId: newFee.id,
      newData: {
        name: newFee.name,
        amount: newFee.amount,
        currency: newFee.currency,
        frequency: newFee.frequency,
      },
      ipAddress: getClientIp(request),
    });

    log.info("fees.created", { schoolId, feeId: newFee.id, amount: newFee.amount });
    return NextResponse.json({ data: newFee }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid fee submission", details: error.issues },
        { status: 400 },
      );
    }

    log.error("fees.post_unexpected", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
