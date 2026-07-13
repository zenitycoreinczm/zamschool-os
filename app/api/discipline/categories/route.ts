import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  getClientIp,
} from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  severity: z.number().int().min(1).max(5).optional(),
});

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from("discipline_categories")
      .select(
        "id, school_id, name, description, severity, is_active, created_at, updated_at",
      )
      .eq("school_id", schoolId)
      .order("severity", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;

    const response = NextResponse.json({ success: true, data: data || [] });
    return applyEdgeCacheHeaders(response, "eventsRead");
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to load discipline categories"),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "discipline",
      "create",
    );
    if (!perm.ok) return perm.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const body = await parseJsonWithSchema(req, createCategorySchema);

    const { data, error } = await supabaseAdmin
      .from("discipline_categories")
      .insert({
        school_id: schoolId,
        name: body.name,
        description: body.description || null,
        severity: body.severity || 1,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A category with this name already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "discipline_category.created",
      entityType: "discipline_categories",
      entityId: data.id,
      newData: { name: body.name, severity: body.severity || 1 },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to create discipline category"),
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "discipline",
      "update",
    );
    if (!perm.ok) return perm.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const body = await parseJsonWithSchema(req, updateCategorySchema);
    const { id, ...updates } = body;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) updatePayload.name = updates.name;
    if (updates.description !== undefined)
      updatePayload.description = updates.description;
    if (updates.severity !== undefined)
      updatePayload.severity = updates.severity;
    if (updates.isActive !== undefined)
      updatePayload.is_active = updates.isActive;

    const { data, error } = await supabaseAdmin
      .from("discipline_categories")
      .update(updatePayload)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "discipline_category.updated",
      entityType: "discipline_categories",
      entityId: id,
      newData: updatePayload,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to update discipline category"),
      },
      { status: 500 },
    );
  }
}
