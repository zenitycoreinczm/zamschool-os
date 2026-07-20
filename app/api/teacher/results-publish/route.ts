import { NextResponse } from "next/server";
import { z } from "zod";

import { invalidatePublishedResultsCache } from "@/lib/published-results-read";
import { syncResultPublishNotifications } from "@/lib/results/sync-notifications";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  applyRateLimit,
  getClientIp,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditDomainWrite } from "@/lib/audit-domain";
import { refreshSchoolReadModels } from "@/lib/read-model-refresh";

const publishSchema = z
  .object({
    assignmentId: z.string().uuid().optional(),
    resultIds: z.array(z.string().uuid()).min(1).optional(),
    examTitle: z.string().optional(),
    classId: z.string().uuid().optional(),
    /** When true, only notify about the teacher's subject rows (not full exam cert). */
    subjectOnly: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.assignmentId ||
      value.resultIds?.length ||
      (value.examTitle && value.classId),
    {
      message: "assignmentId, resultIds, or examTitle+classId is required",
    },
  );

/**
 * Teacher result release — mirrors roll call:
 * upload/save drafts, then publish once → parents get in-app + push alerts
 * and students/parents can view published results.
 */
export async function POST(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-results-publish:${userId}:${ip}`,
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

    const body = await parseJsonWithSchema(req, publishSchema);
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: access.context.profileId || userId,
    });

    if (
      assignmentScope.actorTeacherIds.length === 0 ||
      assignmentScope.allowedClassIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No assigned result scope found" },
        { status: 403 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("results")
      .select(
        `
          id,
          student_id,
          assignment_id,
          published_at,
          grading_status,
          assignments!inner(
            id,
            title,
            class_id,
            subject_id,
            teacher_id
          )
        `,
      )
      .eq("school_id", schoolId);

    if (body.examTitle && body.classId) {
      if (!assignmentScope.allowedClassIds.includes(body.classId)) {
        return NextResponse.json(
          { error: "You are not assigned to this class" },
          { status: 403 },
        );
      }

      const { data: examAssignments } = await supabaseAdmin
        .from("assignments")
        .select("id, teacher_id, class_id")
        .eq("school_id", schoolId)
        .eq("class_id", body.classId)
        .eq("title", body.examTitle);

      const examAssignmentIds = (examAssignments || [])
        .filter(
          (a: any) =>
            assignmentScope.actorTeacherIds.includes(a.teacher_id) &&
            assignmentScope.allowedClassIds.includes(a.class_id),
        )
        .map((a: any) => a.id);

      if (examAssignmentIds.length === 0) {
        return NextResponse.json(
          { error: "No assignments found for this exam and class in your scope" },
          { status: 404 },
        );
      }
      query = query.in("assignment_id", examAssignmentIds);
    } else if (body.assignmentId) {
      query = query.eq("assignment_id", body.assignmentId);
    } else if (body.resultIds?.length) {
      query = query.in("id", body.resultIds);
    }

    const { data: resultRows, error: resultError } = await query;
    if (resultError) throw resultError;

    const scopedResults = (resultRows || []).filter((row: any) => {
      const assignment = normalizeRelation(row.assignments);
      return (
        assignment &&
        assignmentScope.actorTeacherIds.includes(assignment.teacher_id) &&
        assignmentScope.allowedClassIds.includes(assignment.class_id)
      );
    });

    if (scopedResults.length === 0) {
      return NextResponse.json(
        { error: "No publishable results found in assigned scope" },
        { status: 404 },
      );
    }

    // Only publish unpublished drafts (idempotent re-publish of already-published is ok).
    const toPublish = scopedResults.filter((row: any) => !row.published_at);
    const alreadyPublished = scopedResults.length - toPublish.length;
    const publishedAt = new Date().toISOString();
    const resultIds = scopedResults.map((row: any) => row.id);
    const publishIds = (toPublish.length > 0 ? toPublish : scopedResults).map(
      (row: any) => row.id,
    );

    // published_by → profiles.id (not auth.users id)
    const publisherProfileId = access.context.profileId || userId;

    // Teacher direct publish (roll-call style): parents can see results immediately.
    // Full multi-stage moderation remains available on the admin results desk.
    const { error: publishError } = await supabaseAdmin
      .from("results")
      .update({
        grading_status: "published",
        published_at: publishedAt,
        published_by: publisherProfileId,
        submitted_at: publishedAt,
        submitted_by: userId,
      })
      .in("id", publishIds)
      .eq("school_id", schoolId);

    if (publishError) {
      // Some schemas may not have grading_status / submitted_* columns yet.
      if (isMissingColumnError(publishError)) {
        const fallback = await supabaseAdmin
          .from("results")
          .update({
            published_at: publishedAt,
            published_by: publisherProfileId,
          })
          .in("id", publishIds)
          .eq("school_id", schoolId);
        if (fallback.error) throw fallback.error;
      } else {
        throw publishError;
      }
    }

    // Notify parents first (what the teacher is waiting for), then side effects.
    const notificationDelivery = await syncResultPublishNotifications({
      schoolId,
      teacherId: access.context.profileId || userId,
      publishedAt,
      rows: scopedResults,
      mode: body.subjectOnly || body.assignmentId ? "subject" : "exam",
    }).catch((err) => {
      console.error("[results] notification fan-out failed:", err);
      return {
        parentCount: 0,
        notificationCount: 0,
        pushAttempted: false,
        linkedParents: 0,
        reason: "Notification fan-out failed",
      };
    });

    // Do not block the publish response on cache/read-model refresh.
    void invalidatePublishedResultsCache().catch(() => {});
    void refreshSchoolReadModels(schoolId).catch(() => {});
    void auditDomainWrite({
      schoolId,
      userId,
      action: "results.published",
      entityType: "results",
      newData: {
        publishedCount: publishIds.length,
        newlyPublished: toPublish.length,
        alreadyPublished,
        publishedAt,
        parentsNotified: notificationDelivery.parentCount,
        notificationsQueued: notificationDelivery.notificationCount,
        pushAttempted: notificationDelivery.pushAttempted,
      },
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        publishedCount: publishIds.length,
        newlyPublished: toPublish.length,
        alreadyPublished,
        publishedAt,
        resultIds,
        parentsNotified: notificationDelivery.parentCount,
        notificationsQueued: notificationDelivery.notificationCount,
        pushAttempted: notificationDelivery.pushAttempted,
        linkedParents: notificationDelivery.linkedParents,
        notifyReason: notificationDelivery.reason || null,
        message:
          notificationDelivery.parentCount > 0
            ? `Published ${publishIds.length} results · ${notificationDelivery.parentCount} parents notified${
                notificationDelivery.pushAttempted ? " (push sent)" : ""
              }`
            : `Published ${publishIds.length} results. ${notificationDelivery.reason || "No parents notified."}`,
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
      { error: safeErrorMessage(error, "Failed to publish results") },
      { status: 500 },
    );
  }
}

function normalizeRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

function isMissingColumnError(error: { message?: string; code?: string } | null) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("column") &&
    (message.includes("does not exist") ||
      message.includes("grading_status") ||
      message.includes("submitted_at") ||
      message.includes("schema cache"))
  );
}
