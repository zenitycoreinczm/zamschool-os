import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import { requireActorContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { createAuditLog } from "@/lib/audit-log";
import { authorizeWorkflowTransition } from "@/lib/workflow-states";
import { invalidatePublishedResultsCache } from "@/lib/published-results-read";
import { refreshSchoolReadModels } from "@/lib/read-model-refresh";

const transitionSchema = z.object({
  resultIds: z.array(z.string().uuid()).min(1),
  targetStatus: z.enum(["moderated", "approved", "published", "draft"]),
});

const RESULTS_MODERATION_ROLES = [
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "ACADEMIC_ADMIN",
  "SUPER_ADMIN",
] as const;

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...RESULTS_MODERATION_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const perm = await requireFeatureAccess(access.context, "grades", "read");
    if (!perm.ok) return perm.response;

    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const classId = searchParams.get("classId");

    let query = supabaseAdmin
      .from("results")
      .select(
        `
        id, student_id, assignment_id, score, grade, remarks,
        grading_status, submitted_at, submitted_by,
        moderated_at, moderated_by,
        approved_at, approved_by,
        published_at, published_by,
        created_at,
        assignments!inner(id, title, class_id, subject_id, teacher_id, total_marks)
      `,
      )
      .eq("school_id", schoolId);

    if (status) {
      query = query.eq("grading_status", status);
    }
    if (classId) {
      query = query.eq("assignments.class_id", classId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to load results for moderation"),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...RESULTS_MODERATION_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const perm = await requireFeatureAccess(access.context, "grades", "update");
    if (!perm.ok) return perm.response;

    const { schoolId, userId } = access.context;
    const ip = getClientIp(req);

    const rate = await applyRateLimit({
      key: `admin-results-moderation:${userId}:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, transitionSchema);
    const { resultIds, targetStatus } = body;

    // Fetch current results to validate transitions
    const { data: results, error: fetchError } = await supabaseAdmin
      .from("results")
      .select("id, grading_status")
      .in("id", resultIds)
      .eq("school_id", schoolId);

    if (fetchError) throw fetchError;
    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "No results found for the given IDs" },
        { status: 404 },
      );
    }

    // Validate each transition
    for (const result of results) {
      const currentStatus = String(
        result.grading_status || "draft",
      ).toLowerCase();
      const newStatus = targetStatus.toLowerCase();

      if (currentStatus === newStatus) continue;

      const auth = authorizeWorkflowTransition(
        "grading",
        currentStatus,
        newStatus,
        access.context.role,
      );
      if (!auth.allowed) {
        return NextResponse.json(
          { error: auth.reason || "Invalid grading status transition" },
          { status: 403 },
        );
      }
    }

    // Build the update payload based on target status
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      grading_status: targetStatus,
    };

    if (targetStatus === "moderated") {
      updatePayload.moderated_at = now;
      updatePayload.moderated_by = userId;
    } else if (targetStatus === "approved") {
      updatePayload.approved_at = now;
      updatePayload.approved_by = userId;
    } else if (targetStatus === "published") {
      updatePayload.published_at = now;
      updatePayload.published_by = userId;
    }

    const { error: updateError } = await supabaseAdmin
      .from("results")
      .update(updatePayload)
      .in("id", resultIds)
      .eq("school_id", schoolId);

    if (updateError) throw updateError;

    await createAuditLog({
      schoolId,
      userId,
      action: `results.transition.${targetStatus}`,
      entityType: "results",
      newData: {
        resultIds,
        targetStatus,
        transitionedBy: userId,
        ...updatePayload,
      },
      ipAddress: ip,
    });

    // If publishing, refresh caches and read models
    if (targetStatus === "published" && schoolId) {
      await invalidatePublishedResultsCache();
      await refreshSchoolReadModels(schoolId);
    }

    return NextResponse.json({
      success: true,
      data: {
        transitionedCount: resultIds.length,
        targetStatus,
        transitionedAt: now,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to transition results") },
      { status: 500 },
    );
  }
}
