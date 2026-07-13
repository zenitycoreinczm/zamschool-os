import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import {
  requireFinancialReadContext,
  requireFinancialWriteContext,
} from "@/lib/server-auth";
import { hydratePaymentRows } from "@/lib/admin-route-hydration.mjs";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { createAuditLog } from "@/lib/audit-log";
import { invalidateByTag } from "@/lib/enhanced-cache";
import { authorizeWorkflowTransition } from "@/lib/workflow-states";

const createPaymentSchema = z.object({
  studentId: z.string().min(1),
  amount: z.number().min(0),
  currency: z.string().optional().default("ZMW"),
  paymentType: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.string().optional().default("PENDING"),
  paidAt: z.string().optional().nullable(),
});

const updatePaymentSchema = z.object({
  id: z.string().min(1),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  paymentType: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.string().optional(),
  paidAt: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const access = await requireFinancialReadContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "payments", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");
    const paymentType = searchParams.get("paymentType");
    // Dashboard FinanceChart only needs amount/status/created_at — skip the
    // full list + student hydration path that was timing out under load.
    const view = String(searchParams.get("view") || "").trim().toLowerCase();
    const chartView = view === "chart" || view === "summary";

    if (chartView) {
      const year = Number(searchParams.get("year")) || new Date().getFullYear();
      const yearStart = `${year}-01-01T00:00:00.000Z`;
      const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

      const { data, error } = await supabaseAdmin
        .from("payments")
        .select("amount, status, created_at")
        .eq("school_id", schoolId)
        .gte("created_at", yearStart)
        .lt("created_at", yearEnd)
        .order("created_at", { ascending: true })
        .limit(5000);

      if (error) throw error;

      return applyEdgeCacheHeaders(
        NextResponse.json({
          success: true,
          data: data || [],
        }),
        "privateRead",
      );
    }

    let query = supabaseAdmin
      .from("payments")
      .select(
        "id, school_id, student_id, amount, currency, payment_type, payment_method, reference_number, status, paid_at, created_by, created_at, updated_at, receipt_url",
      )
      .eq("school_id", schoolId);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    if (paymentType) {
      query = query.eq("payment_type", paymentType);
    }

    const { data, error } = await query
      .order("created_at", {
        ascending: false,
      })
      .limit(500);

    if (error) throw error;

    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: await attachPaymentRelations(data || [], schoolId),
      }),
      "privateRead",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch payments") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireFinancialWriteContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "payments",
      "create",
    );
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-payments:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createPaymentSchema);

    const payload: Record<string, any> = {
      school_id: schoolId,
      student_id: body.studentId,
      amount: body.amount,
      currency: body.currency,
      payment_type: body.paymentType?.trim() || null,
      payment_method: body.paymentMethod?.trim() || null,
      reference_number: body.referenceNumber?.trim() || null,
      status: body.status,
      paid_at: body.paidAt || null,
      created_by: userId,
    };

    const { data, error } = await supabaseAdmin
      .from("payments")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId,
      action: "payment.create",
      entityType: "payment",
      entityId: data.id,
      newData: payload,
      ipAddress: ip,
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create payment") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireFinancialWriteContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "payments",
      "update",
    );
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-payments:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updatePaymentSchema);

    const payload: Record<string, any> = {};
    if (body.amount !== undefined) payload.amount = body.amount;
    if (body.currency) payload.currency = body.currency;
    if (body.paymentType !== undefined)
      payload.payment_type = body.paymentType?.trim() || null;
    if (body.paymentMethod !== undefined)
      payload.payment_method = body.paymentMethod?.trim() || null;
    if (body.referenceNumber !== undefined)
      payload.reference_number = body.referenceNumber?.trim() || null;
    if (body.status) {
      // Validate payment workflow transition when status changes
      const { data: existing } = await supabaseAdmin
        .from("payments")
        .select("status")
        .eq("id", body.id)
        .eq("school_id", schoolId)
        .maybeSingle();

      const currentStatus = String(existing?.status || "pending").toLowerCase();
      const newStatus = body.status.toLowerCase();

      if (currentStatus !== newStatus) {
        const auth = authorizeWorkflowTransition(
          "payment",
          currentStatus,
          newStatus,
          access.context.role,
        );
        if (!auth.allowed) {
          return NextResponse.json(
            { error: auth.reason || "Invalid payment status transition" },
            { status: 403 },
          );
        }
      }
      payload.status = body.status;

      // Track who verified the payment for audit trail
      if (newStatus === "verified" || newStatus === "locked") {
        payload.verified_by = access.context.userId;
        payload.verified_at = new Date().toISOString();
      }
    }
    if (body.paidAt !== undefined) payload.paid_at = body.paidAt;

    const { data, error } = await supabaseAdmin
      .from("payments")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId: access.context.userId,
      action: "payment.update",
      entityType: "payment",
      entityId: body.id,
      newData: payload,
      ipAddress: ip,
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update payment") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireFinancialWriteContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "payments",
      "delete",
    );
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("payments")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId: access.context.userId,
      action: "payment.delete",
      entityType: "payment",
      entityId: id,
      ipAddress: getClientIp(req),
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete payment") },
      { status: 500 },
    );
  }
}

async function attachPaymentRelations(rows: any[], schoolId: string) {
  const studentIds = Array.from(
    new Set(
      (rows || [])
        .map((row) => String(row?.student_id || "").trim())
        .filter(Boolean),
    ),
  );
  const createdByIds = Array.from(
    new Set(
      (rows || [])
        .map((row) => String(row?.created_by || "").trim())
        .filter(Boolean),
    ),
  );

  const studentRowsResult = await fetchStudentRowsForPayments(schoolId);

  const relevantStudentRows = studentRowsResult.filter(
    (row: any) =>
      studentIds.includes(String(row?.id || "")) ||
      studentIds.includes(String(row?.profile_id || "")),
  );
  const studentProfileIds = Array.from(
    new Set(
      [
        ...studentIds,
        ...relevantStudentRows.map((row: any) =>
          String(row?.profile_id || "").trim(),
        ),
      ].filter(Boolean),
    ),
  );

  const [studentProfilesResult, createdByProfilesResult] = await Promise.all([
    studentProfileIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("school_id", schoolId)
          .in("id", studentProfileIds)
      : Promise.resolve({ data: [], error: null }),
    createdByIds.length > 0
      ? supabaseAdmin
          .from("profiles")
          .select("id, first_name, last_name, email")
          .eq("school_id", schoolId)
          .in("id", createdByIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentProfilesResult.error) throw studentProfilesResult.error;
  if (createdByProfilesResult.error) throw createdByProfilesResult.error;

  const studentProfilesById = Object.fromEntries(
    (studentProfilesResult.data || []).map((profile: any) => [
      String(profile.id),
      profile,
    ]),
  );
  const studentAdmissionByProfileId: Record<string, string | null> = {};

  for (const row of relevantStudentRows) {
    const admissionNumber =
      row?.admission_number || row?.student_number || null;
    const profileId = String(row?.profile_id || "").trim();
    const studentRowId = String(row?.id || "").trim();

    if (profileId) {
      studentAdmissionByProfileId[profileId] = admissionNumber;
      if (studentProfilesById[profileId]) {
        studentProfilesById[studentRowId] = studentProfilesById[profileId];
      }
    }

    if (studentRowId) {
      studentAdmissionByProfileId[studentRowId] = admissionNumber;
    }
  }

  const createdByProfilesById = Object.fromEntries(
    (createdByProfilesResult.data || []).map((profile: any) => [
      String(profile.id),
      profile,
    ]),
  );

  return hydratePaymentRows(rows, {
    studentProfilesById,
    studentAdmissionByProfileId,
    createdByProfilesById,
  });
}

async function fetchStudentRowsForPayments(schoolId: string) {
  const modern = await supabaseAdmin
    .from("students")
    .select("id, profile_id, admission_number, student_number")
    .eq("school_id", schoolId);

  if (!modern.error) {
    return modern.data || [];
  }

  if (!isMissingColumnError(modern.error)) {
    throw modern.error;
  }

  const legacy = await supabaseAdmin
    .from("students")
    .select("id, profile_id, student_number")
    .eq("school_id", schoolId);

  if (legacy.error) throw legacy.error;

  return (legacy.data || []).map((row: any) => ({
    ...row,
    admission_number: row?.student_number || null,
  }));
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" || message.includes("does not exist");
}
