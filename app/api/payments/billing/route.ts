import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requirePaymentsContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { parseBillingGenerateInput } from "@/lib/payment-input";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";
import { invalidateByTag } from "@/lib/enhanced-cache";
import { getClientIp } from "@/lib/server-guards";

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

    const { month, fee_id: feeId } = parseBillingGenerateInput(
      await request.json(),
    );

    // Resolve fee_id if not provided
    let resolvedFeeId = feeId;
    let feeAmount: number;
    if (!resolvedFeeId) {
      const { data: fee, error: feeError } = await supabaseAdmin
        .from("fees")
        .select("id, amount")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .eq("frequency", "monthly")
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (feeError || !fee) {
        return NextResponse.json(
          { error: "No active monthly fee found for this school" },
          { status: 404 },
        );
      }
      resolvedFeeId = fee.id;
      feeAmount = fee.amount;
    } else {
      const { data: fee, error: feeError } = await supabaseAdmin
        .from("fees")
        .select("id, amount")
        .eq("id", resolvedFeeId)
        .eq("school_id", schoolId)
        .single();

      if (feeError || !fee) {
        return NextResponse.json(
          { error: "Fee not found or access denied" },
          { status: 404 },
        );
      }
      feeAmount = fee.amount;
    }

    // Fetch active students
    const { data: students, error: studentsError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("school_id", schoolId)
      .eq("role", "student")
      .or("status.eq.ACTIVE,status.is.null");

    if (studentsError) {
      console.error("Error fetching students:", studentsError);
      return NextResponse.json(
        { error: "Failed to fetch students" },
        { status: 500 },
      );
    }

    if (!students || students.length === 0) {
      return NextResponse.json({ generated: 0, skipped: 0, month });
    }

    // Calculate due date (last day of the billing month)
    const billingDate = new Date(month);
    const dueDate = new Date(
      billingDate.getFullYear(),
      billingDate.getMonth() + 1,
      0,
    );
    const dueDateStr = dueDate.toISOString().split("T")[0];

    // Build rows for all active students; ON CONFLICT handles idempotency
    const rows = students.map((student) => ({
      student_id: student.id,
      fee_id: resolvedFeeId,
      school_id: schoolId,
      billing_month: month,
      amount_due: feeAmount,
      status: "PENDING" as const,
      due_date: dueDateStr,
    }));

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("student_fees")
      .upsert(rows, {
        onConflict: "student_id,fee_id,billing_month",
      })
      .select();

    if (insertError) {
      console.error("Error generating bills:", insertError);
      return NextResponse.json(
        { error: "Failed to generate bills" },
        { status: 500 },
      );
    }

    const generated = inserted?.length || 0;
    const skipped = students.length - generated;

    await auditDomainWrite({
      schoolId,
      userId,
      action: "billing.generated",
      entityType: "student_fees",
      newData: {
        month,
        feeId: resolvedFeeId,
        generated,
        skipped,
        studentCount: students.length,
      },
      ipAddress: getClientIp(request),
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    return NextResponse.json({ generated, skipped, month });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Error in billing POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
