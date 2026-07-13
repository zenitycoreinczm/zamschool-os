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
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { assertDomainAccess } from "@/lib/domain-ownership";
import { createAuditLog } from "@/lib/audit-log";

const createFinanceRecordSchema = z.object({
  transactionType: z.enum(["income", "expense"]),
  category: z.string().optional(),
  amount: z.number().min(0),
  currency: z.string().optional().default("ZMW"),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  transactionDate: z.string().min(1),
});

const updateFinanceRecordSchema = z.object({
  id: z.string().min(1),
  transactionType: z.enum(["income", "expense"]).optional(),
  category: z.string().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNumber: z.string().optional(),
  transactionDate: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireFinancialReadContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "finance", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const transactionType = searchParams.get("transactionType");
    const category = searchParams.get("category");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabaseAdmin
      .from("finance_records")
      .select(
        `
        *,
        profiles:recorded_by(first_name, last_name, email)
      `,
      )
      .eq("school_id", schoolId);

    if (transactionType) {
      query = query.eq("transaction_type", transactionType);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (startDate) {
      query = query.gte("transaction_date", startDate);
    }

    if (endDate) {
      query = query.lte("transaction_date", endDate);
    }

    const { data, error } = await query.order("transaction_date", {
      ascending: false,
    });

    if (error) throw error;

    // Calculate summary
    const summary = {
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
    };

    if (data) {
      for (const record of data) {
        if (record.transaction_type === "income") {
          summary.totalIncome += Number(record.amount);
        } else {
          summary.totalExpense += Number(record.amount);
        }
      }
      summary.netBalance = summary.totalIncome - summary.totalExpense;
    }

    return NextResponse.json({ success: true, data, summary });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch finance records") },
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
      "finance",
      "create",
    );
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "finance",
      role: access.context.role,
      action: "create",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }
    const { schoolId, userId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-finance:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createFinanceRecordSchema);

    const payload: Record<string, any> = {
      school_id: schoolId,
      transaction_type: body.transactionType,
      category: body.category?.trim() || null,
      amount: body.amount,
      currency: body.currency,
      description: body.description?.trim() || null,
      payment_method: body.paymentMethod?.trim() || null,
      reference_number: body.referenceNumber?.trim() || null,
      transaction_date: body.transactionDate,
      recorded_by: userId,
    };

    const { data, error } = await supabaseAdmin
      .from("finance_records")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId,
      action: "finance.create",
      entityType: "finance_record",
      entityId: data.id,
      newData: data,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create finance record") },
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
      "finance",
      "update",
    );
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "finance",
      role: access.context.role,
      action: "update",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }
    const { schoolId, userId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-finance:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateFinanceRecordSchema);
    const { data: existingRecord, error: existingError } = await supabaseAdmin
      .from("finance_records")
      .select(
        "id, school_id, transaction_type, category, amount, currency, description, payment_method, reference_number, transaction_date, recorded_by, created_at, updated_at, attachment_url, attachment_name",
      )
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Finance record not found" },
        { status: 404 },
      );
    }

    const payload: Record<string, any> = {};
    if (body.transactionType) payload.transaction_type = body.transactionType;
    if (body.category !== undefined)
      payload.category = body.category?.trim() || null;
    if (body.amount !== undefined) payload.amount = body.amount;
    if (body.currency) payload.currency = body.currency;
    if (body.description !== undefined)
      payload.description = body.description?.trim() || null;
    if (body.paymentMethod !== undefined)
      payload.payment_method = body.paymentMethod?.trim() || null;
    if (body.referenceNumber !== undefined)
      payload.reference_number = body.referenceNumber?.trim() || null;
    if (body.transactionDate) payload.transaction_date = body.transactionDate;

    const { data, error } = await supabaseAdmin
      .from("finance_records")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId,
      action: "finance.update",
      entityType: "finance_record",
      entityId: body.id,
      oldData: existingRecord,
      newData: data,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update finance record") },
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
      "finance",
      "delete",
    );
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "finance",
      role: access.context.role,
      action: "delete",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }
    const { schoolId, userId } = access.context;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Finance record ID is required" },
        { status: 400 },
      );
    }

    const { data: existingRecord, error: existingError } = await supabaseAdmin
      .from("finance_records")
      .select(
        "id, school_id, transaction_type, category, amount, currency, description, payment_method, reference_number, transaction_date, recorded_by, created_at, updated_at, attachment_url, attachment_name",
      )
      .eq("id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingRecord) {
      return NextResponse.json(
        { error: "Finance record not found" },
        { status: 404 },
      );
    }

    const { error } = await supabaseAdmin
      .from("finance_records")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await createAuditLog({
      schoolId,
      userId,
      action: "finance.delete",
      entityType: "finance_record",
      entityId: id,
      oldData: existingRecord,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete finance record") },
      { status: 500 },
    );
  }
}
