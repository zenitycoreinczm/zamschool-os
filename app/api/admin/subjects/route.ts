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
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { auditDomainWrite } from "@/lib/audit-domain";
import { enforceRouteAccess } from "@/lib/route-enforcement";
import { invalidateByTag } from "@/lib/enhanced-cache";

const createSubjectSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional(),
});

const updateSubjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  code: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;

    const { data, error } = await supabaseAdmin
      .from("subjects")
      .select("id, school_id, name, code, description, created_at")
      .eq("school_id", schoolId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch subjects") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "subjects",
      featureAction: "create",
      domain: "academic",
      domainAction: "create",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-subjects:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createSubjectSchema);

    const payload: Record<string, any> = {
      school_id: schoolId,
      name: body.name.trim(),
      code: body.code?.trim() || null,
    };

    const { data, error } = await supabaseAdmin
      .from("subjects")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "subjects.create",
      entityType: "subject",
      entityId: data.id,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create subject") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "subjects",
      featureAction: "update",
      domain: "academic",
      domainAction: "update",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-subjects:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateSubjectSchema);

    const payload: Record<string, any> = {};
    if (body.name) payload.name = body.name.trim();
    if (body.code !== undefined) payload.code = body.code.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("subjects")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "subjects.update",
      entityType: "subject",
      entityId: body.id,
      newData: data,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update subject") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "subjects",
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
        { error: "Subject ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("subjects")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "subjects.delete",
      entityType: "subject",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    await invalidateByTag("dashboard");
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete subject") },
      { status: 500 },
    );
  }
}
