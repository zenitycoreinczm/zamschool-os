import { NextResponse } from "next/server";
import { z } from "zod";

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

    // Rows already released by the approval desk stay released: writing
    // grading_status back to "submitted" here would withdraw results that
    // parents and pupils can already see.
    const isReleased = (row: any) =>
      Boolean(row.published_at) ||
      ["published", "approved"].includes(String(row.grading_status || "").toLowerCase());

    const toSubmit = scopedResults.filter((row: any) => !isReleased(row));
    const alreadyReleased = scopedResults.length - toSubmit.length;
    const actedAt = new Date().toISOString();
    const resultIds = scopedResults.map((row: any) => row.id);

    if (toSubmit.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          submittedCount: 0,
          alreadyReleased,
          actedAt,
          resultIds,
          parentsNotified: 0,
          notificationsQueued: 0,
          pushAttempted: false,
          linkedParents: 0,
          notifyReason: "Already released by the approval desk",
          message: `Already released — ${alreadyReleased} results are with parents.`,
        },
      });
    }

    // Releasing results is the head teacher's authority, on this client exactly
    // as on mobile, where the edge refuses `published` for anyone outside
    // canApproveFinalResults. A teacher hands the marks over; the approval desk
    // at /api/admin/results sets published_at/published_by. Writing `published`
    // from here let any teacher put unverified marks in front of parents and
    // made the two clients disagree about who owns the final result.
    const { error: submitError } = await supabaseAdmin
      .from("results")
      .update({
        grading_status: "submitted",
        submitted_at: actedAt,
        submitted_by: userId,
      })
      .in("id", toSubmit.map((row: any) => row.id))
      .eq("school_id", schoolId);

    if (submitError) {
      // A deployment whose results table predates the approval columns has no
      // chain to hold the marks in, so release is the only state it can express.
      if (isMissingColumnError(submitError)) {
        const fallback = await supabaseAdmin
          .from("results")
          .update({
            published_at: actedAt,
            // published_by → profiles.id (not auth.users id)
            published_by: access.context.profileId || userId,
          })
          .in("id", toSubmit.map((row: any) => row.id))
          .eq("school_id", schoolId);
        if (fallback.error) throw fallback.error;
      } else {
        throw submitError;
      }
    }

    // Parents are told when the marks are released, not when a teacher hands
    // them over; notifying here would announce a result the school has not
    // approved yet.
    const notificationDelivery = {
      parentCount: 0,
      notificationCount: 0,
      pushAttempted: false,
      linkedParents: 0,
      reason: "Awaiting approval by the head teacher",
    };

    void auditDomainWrite({
      schoolId,
      userId,
      action: "results.submitted",
      entityType: "results",
      newData: {
        submittedCount: toSubmit.length,
        alreadyReleased,
        submittedAt: actedAt,
      },
      ipAddress: ip,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        submittedCount: toSubmit.length,
        publishedCount: 0,
        newlyPublished: 0,
        alreadyReleased,
        actedAt,
        resultIds,
        parentsNotified: notificationDelivery.parentCount,
        notificationsQueued: notificationDelivery.notificationCount,
        pushAttempted: notificationDelivery.pushAttempted,
        linkedParents: notificationDelivery.linkedParents,
        notifyReason: notificationDelivery.reason,
        message: `Sent ${toSubmit.length} results for approval. The head teacher releases them to parents and pupils.`,
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
