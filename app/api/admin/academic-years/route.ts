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
import { invalidateByTag } from "@/lib/enhanced-cache";

const createAcademicYearSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isActive: z.boolean().optional().default(false),
});

const updateAcademicYearSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    const { data, error } = await supabaseAdmin
      .from("academic_years")
      .select(
        `
        *,
        terms(id, name, start_date, end_date, is_active)
      `,
      )
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch academic years") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "academic_years",
      featureAction: "create",
      domain: "academic",
      domainAction: "create",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-academic-years:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createAcademicYearSchema);

    // If setting as active, deactivate other years
    if (body.isActive) {
      await supabaseAdmin
        .from("academic_years")
        .update({ is_active: false })
        .eq("school_id", schoolId);
    }

    const payload: Record<string, any> = {
      school_id: schoolId,
      name: body.name.trim(),
      start_date: body.startDate,
      end_date: body.endDate,
      is_active: body.isActive,
    };

    const { data, error } = await supabaseAdmin
      .from("academic_years")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "academic_years.create",
      entityType: "academic_year",
      entityId: data.id,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create academic year") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "academic_years",
      featureAction: "update",
      domain: "academic",
      domainAction: "update",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-academic-years:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateAcademicYearSchema);

    // If setting as active, deactivate other years
    if (body.isActive) {
      const { data: year } = await supabaseAdmin
        .from("academic_years")
        .select("school_id")
        .eq("id", body.id)
        .eq("school_id", schoolId)
        .single();

      if (year) {
        await supabaseAdmin
          .from("academic_years")
          .update({ is_active: false })
          .eq("school_id", year.school_id);
      }
    }

    const payload: Record<string, any> = {};
    if (body.name) payload.name = body.name.trim();
    if (body.startDate) payload.start_date = body.startDate;
    if (body.endDate) payload.end_date = body.endDate;
    if (body.isActive !== undefined) payload.is_active = body.isActive;

    const { data, error } = await supabaseAdmin
      .from("academic_years")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "academic_years.update",
      entityType: "academic_year",
      entityId: body.id,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update academic year") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "academic_years",
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
        { error: "Academic year ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("academic_years")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "academic_years.delete",
      entityType: "academic_year",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete academic year") },
      { status: 500 },
    );
  }
}
