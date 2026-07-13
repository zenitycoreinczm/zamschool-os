import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseAdmin } from "@/lib/supabase";
import { requireActorContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { createAuditLog } from "@/lib/audit-log";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  assertDomainAccess,
  type DomainAction,
  type SchoolDomain,
} from "@/lib/domain-ownership";
import { authorizeWorkflowTransition } from "@/lib/workflow-states";

const transitionSchema = z.object({
  studentId: z.string().uuid(),
  targetStatus: z.enum(["registered", "class_assigned", "active", "withdrawn"]),
  reason: z.string().max(500).optional(),
});

const ADMISSION_ROLES = [
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "ACADEMIC_ADMIN",
  "REGISTRAR",
  "ICT_ADMIN",
  "SUPER_ADMIN",
] as const;

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ADMISSION_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const classId = searchParams.get("classId");

    let query = supabaseAdmin
      .from("students")
      .select(
        `
        id, profile_id, school_id, class_id,
        admission_number, student_number,
        admission_status, admission_status_updated_at,
        enrollment_date, is_active,
        profiles:profile_id(id, first_name, last_name, email)
      `,
      )
      .eq("school_id", schoolId);

    if (status) {
      query = query.eq("admission_status", status);
    }
    if (classId) {
      query = query.eq("class_id", classId);
    }

    const { data, error } = await query.order("admission_status_updated_at", {
      ascending: false,
      nullsFirst: false,
    });

    if (error) {
      // Fallback if admission_status columns don't exist yet
      if (
        error.code === "42703" ||
        error.code === "PGRST204" ||
        String(error.message || "").includes("does not exist")
      ) {
        const fallbackQuery = supabaseAdmin
          .from("students")
          .select(
            "id, profile_id, school_id, class_id, admission_number, student_number, enrollment_date, is_active",
          )
          .eq("school_id", schoolId);

        const { data: fallbackData, error: fallbackError } =
          await fallbackQuery.order("enrollment_date", {
            ascending: false,
            nullsFirst: false,
          });

        if (fallbackError) throw fallbackError;

        return NextResponse.json({
          success: true,
          data: (fallbackData || []).map((row: any) => ({
            ...row,
            admission_status: row.admission_status || "registered",
          })),
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to load student admissions"),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ADMISSION_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;
    const { schoolId, userId } = access.context;
    const ip = getClientIp(req);

    const rate = await applyRateLimit({
      key: `admission-transition:${userId}:${ip}`,
      limit: 30,
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

    const body = await parseJsonWithSchema(req, transitionSchema);
    const { studentId, targetStatus, reason } = body;

    // Fetch current student record
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, admission_status, class_id, profile_id")
      .eq("id", studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json(
        { error: "Student not found in this school" },
        { status: 404 },
      );
    }

    const currentStatus = String(student.admission_status || "registered");

    // Validate the workflow transition
    const auth = authorizeWorkflowTransition(
      "admission",
      currentStatus,
      targetStatus,
      access.context.role,
    );

    if (!auth.allowed) {
      return NextResponse.json(
        { error: auth.reason || "Invalid admission status transition" },
        { status: 403 },
      );
    }

    const transitionKey = `${currentStatus}→${targetStatus}`;
    const transitionAccess: {
      feature: string;
      domain: SchoolDomain;
      action: DomainAction;
    } =
      transitionKey === "class_assigned→active"
        ? {
            feature: "overrides",
            domain: "governance",
            action: "approve" as const,
          }
        : transitionKey === "registered→class_assigned"
          ? {
              feature: "classes",
              domain: "academic",
              action: "update" as const,
            }
          : access.context.role === "PRINCIPAL"
            ? {
                feature: "overrides",
                domain: "governance",
                action: "approve" as const,
              }
            : {
                feature: "users",
                domain: "registry",
                action: "update" as const,
              };

    const feature = await requireFeatureAccess(
      access.context,
      transitionAccess.feature,
      transitionAccess.action === "create" ||
        transitionAccess.action === "read" ||
        transitionAccess.action === "update" ||
        transitionAccess.action === "delete"
        ? transitionAccess.action
        : "update",
    );
    if (!feature.ok) return feature.response;

    const domain = assertDomainAccess({
      domain: transitionAccess.domain,
      role: access.context.role,
      action: transitionAccess.action,
    });
    if (!domain.ok) {
      return NextResponse.json({ error: domain.error }, { status: 403 });
    }

    // For class_assigned, require a class_id
    if (targetStatus === "class_assigned" && !student.class_id) {
      return NextResponse.json(
        {
          error:
            "Student must be assigned to a class before transitioning to 'class_assigned'. Use the class assignment endpoint first.",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      admission_status: targetStatus,
      admission_status_updated_at: now,
      admission_status_updated_by: userId,
    };

    // When activating, also set is_active to true
    if (targetStatus === "active") {
      updatePayload.is_active = true;
    }
    // When withdrawing, set is_active to false
    if (targetStatus === "withdrawn") {
      updatePayload.is_active = false;
    }

    const { error: updateError } = await supabaseAdmin
      .from("students")
      .update(updatePayload)
      .eq("id", studentId)
      .eq("school_id", schoolId);

    if (updateError) throw updateError;

    await createAuditLog({
      schoolId,
      userId,
      action: `admission.transition.${targetStatus}`,
      entityType: "student",
      entityId: studentId,
      oldData: { admission_status: currentStatus },
      newData: { admission_status: targetStatus, reason: reason || null },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      data: {
        studentId,
        previousStatus: currentStatus,
        newStatus: targetStatus,
        transitionedAt: now,
        transitionedBy: userId,
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
      {
        error: safeErrorMessage(error, "Failed to transition admission status"),
      },
      { status: 500 },
    );
  }
}
