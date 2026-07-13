import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";
import { auditDomainWrite } from "@/lib/audit-domain";
import { enforceRouteAccess } from "@/lib/route-enforcement";

const createGradingScaleSchema = z.object({
  name: z.string().min(1).optional(),
  minScore: z.number().min(0),
  maxScore: z.number().min(0),
  grade: z.string().min(1),
  description: z.string().optional(),
});

const updateGradingScaleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  minScore: z.number().min(0).optional(),
  maxScore: z.number().min(0).optional(),
  grade: z.string().min(1).optional(),
  description: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    const { data, error } = await supabaseAdmin
      .from("grading_scales")
      .select("id, school_id, grade, min_score, max_score, remarks, created_at")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: (data || []).map(normalizeGradingScaleRow),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch grading scales") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "grading_scales",
      featureAction: "create",
      domain: "academic",
      domainAction: "create",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-grading-scales:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createGradingScaleSchema);

    const payload: Record<string, any> = {
      school_id: schoolId,
      min_score: body.minScore,
      max_score: body.maxScore,
      grade: body.grade.trim(),
      remarks: body.description?.trim() || body.name?.trim() || null,
    };

    const { data, error } = await supabaseAdmin
      .from("grading_scales")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    const normalized = normalizeGradingScaleRow(data);
    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "grading_scales.create",
      entityType: "grading_scale",
      entityId: data.id,
      newData: normalized,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      data: normalized,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create grading scale") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "grading_scales",
      featureAction: "update",
      domain: "academic",
      domainAction: "update",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-grading-scales:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateGradingScaleSchema);

    const payload: Record<string, any> = {};
    if (body.minScore !== undefined) payload.min_score = body.minScore;
    if (body.maxScore !== undefined) payload.max_score = body.maxScore;
    if (body.grade) payload.grade = body.grade.trim();
    if (body.description !== undefined || body.name !== undefined) {
      payload.remarks = body.description?.trim() || body.name?.trim() || null;
    }

    const { data, error } = await supabaseAdmin
      .from("grading_scales")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    const normalized = normalizeGradingScaleRow(data);
    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "grading_scales.update",
      entityType: "grading_scale",
      entityId: body.id,
      newData: normalized,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      data: normalized,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update grading scale") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "grading_scales",
      featureAction: "delete",
      domain: "academic",
      domainAction: "delete",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Grading scale ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("grading_scales")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "grading_scales.delete",
      entityType: "grading_scale",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete grading scale") },
      { status: 500 },
    );
  }
}

function normalizeGradingScaleRow(row: Record<string, any> | null) {
  if (!row) return row;

  return {
    ...row,
    name: row.remarks || row.grade,
    description: row.remarks || null,
  };
}
