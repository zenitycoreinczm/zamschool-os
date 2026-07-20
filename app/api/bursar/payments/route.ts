import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";

import { requireFeatureAccess } from "@/lib/feature-permissions";
import { requirePaymentsContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";
import { invalidateByTag } from "@/lib/enhanced-cache";
import {
  extractIdempotencyKey,
  hashRequestPayload,
  loadIdempotentResponse,
  mintReceiptNumber,
  storeIdempotentResponse,
} from "@/lib/idempotency";

/**
 * Mobile bursar payment recording.
 *
 * POST /api/bursar/payments
 * Body (mobile):
 * {
 *   studentId, amount, method, receiptNumber?, reference?,
 *   studentName?, admissionNumber?, idempotencyKey?
 * }
 *
 * Server mints the authoritative receipt number and stores it as
 * payments.reference_number. Client provisional numbers are ignored for uniqueness.
 * Duplicate Idempotency-Key returns the original success response.
 */

const mobilePaymentSchema = z.object({
  studentId: z.string().uuid(),
  amount: z.coerce.number().finite().positive().max(1_000_000),
  method: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  paymentMethod: z.string().trim().min(1).max(64).optional(),
  paymentType: z.string().trim().min(1).max(64).optional(),
  reference: z.string().trim().max(120).optional().nullable(),
  referenceNumber: z.string().trim().max(120).optional().nullable(),
  /** Client provisional only — server overwrites with mintReceiptNumber(). */
  receiptNumber: z.string().trim().max(120).optional().nullable(),
  studentName: z.string().trim().max(200).optional().nullable(),
  admissionNumber: z.string().trim().max(64).optional().nullable(),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
});

function normalizeMethod(raw: string | undefined): string {
  const m = String(raw || "cash")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (m === "bank" || m === "bank_transfer" || m === "transfer") return "bank_transfer";
  if (m === "mobile" || m === "mobile_money" || m === "momo") return "mobile_money";
  if (m === "cheque" || m === "check") return "cheque";
  if (m === "cash") return "cash";
  return m || "cash";
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
    if (!schoolId || !userId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(request);
    const rate = await applyRateLimit({
      key: `bursar-payments:${userId}:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const body = await parseJsonWithSchema(request, mobilePaymentSchema);
    const idempotencyKey = extractIdempotencyKey(request, body);
    const routeKey = "bursar.payments.create";
    const scopeKey = `${schoolId}:${userId}`;

    if (idempotencyKey) {
      const replay = await loadIdempotentResponse({
        routeKey,
        schoolId,
        scopeKey,
        idempotencyKey,
      });
      if (replay) return replay;
    }

    const paymentMethod = normalizeMethod(body.method || body.paymentMethod);
    const paymentType = body.paymentType?.trim() || "school_fees";
    // Prefer explicit fee/reference from bursar; never use client provisional receipt as key.
    const clientReference =
      body.referenceNumber?.trim() ||
      body.reference?.trim() ||
      null;

    const receiptNumber = mintReceiptNumber();
    // Store authoritative receipt in reference_number so existing schema works
    // without a migration. Prefer receipt when client had no bank/cheque ref.
    const referenceNumber = clientReference || receiptNumber;

    const requestHash = hashRequestPayload({
      studentId: body.studentId,
      amount: body.amount,
      paymentMethod,
      paymentType,
      referenceNumber,
    });

    const { data: transactionResult, error: paymentError } =
      await supabaseAdmin.rpc("record_student_payment_transaction", {
        p_school_id: schoolId,
        p_student_id: body.studentId,
        p_amount: body.amount,
        p_payment_type: paymentType,
        p_payment_method: paymentMethod,
        p_reference_number: referenceNumber,
        p_created_by: userId,
      });

    if (paymentError) {
      if (paymentError.message.includes("Student not found or access denied")) {
        return NextResponse.json(
          { error: "Student not found or access denied" },
          { status: 404 },
        );
      }
      console.error("[bursar/payments]", paymentError);
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 },
      );
    }

    const payload = (transactionResult || {}) as {
      payment?: Record<string, unknown> & { id?: string; reference_number?: string };
      remaining_amount?: number | string | null;
      applied_fee_ids?: string[] | null;
    };
    const payment = payload.payment;

    if (!payment?.id) {
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 },
      );
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "payment.recorded",
      entityType: "payments",
      entityId: String(payment.id),
      newData: {
        studentId: body.studentId,
        amount: body.amount,
        paymentMethod,
        paymentType,
        receiptNumber,
        referenceNumber,
        clientProvisionalReceipt: body.receiptNumber || null,
        remainingAmount: Number(payload.remaining_amount || 0),
        appliedFeeIds: payload.applied_fee_ids || [],
        channel: "mobile_bursar",
      },
      ipAddress: ip,
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    const responseBody = {
      success: true,
      data: {
        ...payment,
        receiptNumber,
        receipt_number: receiptNumber,
        referenceNumber: payment.reference_number || referenceNumber,
      },
    };

    if (idempotencyKey) {
      await storeIdempotentResponse(
        { routeKey, schoolId, scopeKey, idempotencyKey },
        requestHash,
        201,
        responseBody,
      );
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payment submission", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to record payment") },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const access = await requirePaymentsContext(request);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "payments", "read");
    if (!perm.ok) return perm.response;

    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

    let query = supabaseAdmin
      .from("payments")
      .select(
        "id, school_id, student_id, amount, currency, payment_type, payment_method, reference_number, status, paid_at, created_by, created_at",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data || []).map((row) => ({
        ...row,
        receiptNumber: row.reference_number,
        receipt_number: row.reference_number,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to list payments") },
      { status: 500 },
    );
  }
}
