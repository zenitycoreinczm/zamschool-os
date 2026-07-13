import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";
import { auditDomainWrite } from "@/lib/audit-domain";
import { enforceRouteAccess } from "@/lib/route-enforcement";
import { invalidateByTag } from "@/lib/enhanced-cache";

const createTermSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  academicYearId: z.string().min(1),
  isActive: z.boolean().optional().default(false),
});

const updateTermSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  academicYearId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    const { data, error } = await supabaseAdmin
      .from("terms")
      .select(
        "id, school_id, academic_year_id, name, start_date, end_date, is_active, created_at, updated_at",
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch terms") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "terms",
      featureAction: "create",
      domain: "academic",
      domainAction: "create",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const rate = await applyRateLimit({
      key: `admin-terms:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createTermSchema);
    const year = await fetchAcademicYear(body.academicYearId, schoolId);
    if (!year) {
      return NextResponse.json(
        { error: "Academic year not found in this school" },
        { status: 404 },
      );
    }

    if (body.isActive) {
      await supabaseAdmin
        .from("terms")
        .update({ is_active: false })
        .eq("school_id", schoolId);
    }

    const { data, error } = await supabaseAdmin
      .from("terms")
      .insert({
        school_id: schoolId,
        academic_year_id: body.academicYearId,
        name: body.name.trim(),
        start_date: body.startDate,
        end_date: body.endDate,
        is_active: body.isActive,
      })
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "terms.create",
      entityType: "term",
      entityId: data.id,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create term") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "terms",
      featureAction: "update",
      domain: "academic",
      domainAction: "update",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const rate = await applyRateLimit({
      key: `admin-terms:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateTermSchema);
    const existing = await fetchTerm(body.id, schoolId);
    if (!existing) {
      return NextResponse.json(
        { error: "Term not found in this school" },
        { status: 404 },
      );
    }

    if (body.academicYearId) {
      const year = await fetchAcademicYear(body.academicYearId, schoolId);
      if (!year) {
        return NextResponse.json(
          { error: "Academic year not found in this school" },
          { status: 404 },
        );
      }
    }

    if (body.isActive) {
      await supabaseAdmin
        .from("terms")
        .update({ is_active: false })
        .eq("school_id", schoolId);
    }

    const payload: Record<string, unknown> = {};
    if (body.name) payload.name = body.name.trim();
    if (body.startDate) payload.start_date = body.startDate;
    if (body.endDate) payload.end_date = body.endDate;
    if (body.academicYearId) payload.academic_year_id = body.academicYearId;
    if (body.isActive !== undefined) payload.is_active = body.isActive;

    const { data, error } = await supabaseAdmin
      .from("terms")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "terms.update",
      entityType: "term",
      entityId: body.id,
      oldData: existing,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update term") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "terms",
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
        { error: "Term ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("terms")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "terms.delete",
      entityType: "term",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete term") },
      { status: 500 },
    );
  }
}

async function fetchAcademicYear(id: string, schoolId: string | null) {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchTerm(id: string, schoolId: string | null) {
  const { data, error } = await supabaseAdmin
    .from("terms")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
