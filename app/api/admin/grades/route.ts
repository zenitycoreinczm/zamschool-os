import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { assertDomainAccess } from "@/lib/domain-ownership";
import { createAuditLog } from "@/lib/audit-log";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";

const createGradeSchema = z.object({
  level: z.number().int().min(1).max(13),
  name: z.string().optional(),
});

const updateGradeSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(1).max(13).optional(),
  name: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "grades", "read");
    if (!perm.ok) return perm.response;

    const { data, error } = await supabaseAdmin
      .from("grades")
      .select("id, school_id, level, name, created_at")
      .eq("school_id", access.context.schoolId)
      .order("level", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      if (isMissingGradesSchemaError(error)) {
        return NextResponse.json({ success: true, data: [] });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch grades") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "grades", "create");
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "academic",
      role: access.context.role,
      action: "create",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }
    const ip = getClientIp(req);

    const rate = await applyRateLimit({
      key: `admin-grades:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createGradeSchema);
    const payload = {
      school_id: access.context.schoolId,
      level: body.level,
      name: body.name?.trim() || `Grade ${body.level}`,
    };

    const { data, error } = await supabaseAdmin
      .from("grades")
      .insert(payload)
      .select()
      .single();

    if (error) {
      if (isMissingGradesSchemaError(error)) {
        return NextResponse.json(
          {
            error:
              "Grades are not configured in this database yet. Apply the live prerequisite migration to enable grade management.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "grades.create",
      entityType: "grade",
      entityId: data.id,
      newData: data,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("Admin grades POST error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create grade") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "grades", "update");
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "academic",
      role: access.context.role,
      action: "update",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }
    const ip = getClientIp(req);

    const rate = await applyRateLimit({
      key: `admin-grades:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateGradeSchema);
    const { data: existingGrade, error: existingError } = await supabaseAdmin
      .from("grades")
      .select("id, school_id, level, name, created_at")
      .eq("id", body.id)
      .eq("school_id", access.context.schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingGrade) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    const payload: Record<string, any> = {};
    if (body.level !== undefined) payload.level = body.level;
    if (body.name !== undefined) payload.name = body.name.trim() || null;

    const { data, error } = await supabaseAdmin
      .from("grades")
      .update(payload)
      .eq("id", body.id)
      .eq("school_id", access.context.schoolId)
      .select()
      .single();

    if (error) {
      if (isMissingGradesSchemaError(error)) {
        return NextResponse.json(
          {
            error:
              "Grades are not configured in this database yet. Apply the live prerequisite migration to enable grade management.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "grades.update",
      entityType: "grade",
      entityId: body.id,
      oldData: existingGrade,
      newData: data,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update grade") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "grades", "delete");
    if (!perm.ok) return perm.response;
    const domain = assertDomainAccess({
      domain: "academic",
      role: access.context.role,
      action: "delete",
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Grade ID is required" },
        { status: 400 },
      );
    }

    const { data: existingGrade, error: existingError } = await supabaseAdmin
      .from("grades")
      .select("id, school_id, level, name, created_at")
      .eq("id", id)
      .eq("school_id", access.context.schoolId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingGrade) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from("grades")
      .delete()
      .eq("id", id)
      .eq("school_id", access.context.schoolId);

    if (error) {
      if (isMissingGradesSchemaError(error)) {
        return NextResponse.json(
          {
            error:
              "Grades are not configured in this database yet. Apply the live prerequisite migration to enable grade management.",
          },
          { status: 503 },
        );
      }
      throw error;
    }

    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "grades.delete",
      entityType: "grade",
      entityId: id,
      oldData: existingGrade,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete grade") },
      { status: 500 },
    );
  }
}

function isMissingGradesSchemaError(
  error:
    | { code?: string | null; message?: string | null; details?: string | null }
    | null
    | undefined,
) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  const details = String(error?.details || "");

  return (
    code === "PGRST205" ||
    code === "PGRST200" ||
    code === "42P01" ||
    message.includes("public.grades") ||
    message.includes("table 'public.grades'") ||
    message.includes('relation "grades" does not exist') ||
    details.includes("grades")
  );
}
