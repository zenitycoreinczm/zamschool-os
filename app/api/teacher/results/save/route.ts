import { NextResponse } from "next/server";
import { z } from "zod";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditDomainWrite } from "@/lib/audit-domain";
import { invalidateByTag } from "@/lib/enhanced-cache";
import { getECZGrade } from "@/lib/zambia-localization";
import {
  extractIdempotencyKey,
  hashRequestPayload,
  loadIdempotentResponse,
  storeIdempotentResponse,
} from "@/lib/idempotency";

/**
 * Mobile / offline-queue draft results save.
 * POST /api/teacher/results/save
 *
 * { assignmentId, results: [{ studentId, score, grade?, remarks? }], idempotencyKey? }
 *
 * - Verifies teacher owns the assignment (class + subject scope)
 * - Rejects writes once any result for the assignment is published
 * - Upserts drafts only (published_at stays null)
 */

const resultRowSchema = z.object({
  studentId: z.string().uuid(),
  score: z.coerce.number().finite().min(0).max(1000).nullable().optional(),
  grade: z.string().trim().max(8).optional().nullable(),
  remarks: z.string().trim().max(500).optional().nullable(),
});

const saveSchema = z.object({
  assignmentId: z.string().uuid(),
  results: z.array(resultRowSchema).min(1).max(500),
  idempotencyKey: z.string().trim().max(128).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId || !userId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-results-save:${userId}:${ip}`,
      limit: 40,
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

    const body = await parseJsonWithSchema(req, saveSchema);
    const idempotencyKey = extractIdempotencyKey(req, body);
    const routeKey = "teacher.results.save";
    const scopeKey = `${schoolId}:${userId}:${body.assignmentId}`;

    if (idempotencyKey) {
      const replay = await loadIdempotentResponse({
        routeKey,
        schoolId,
        scopeKey,
        idempotencyKey,
      });
      if (replay) return replay;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: access.context.profileId || userId,
    });

    if (
      assignmentScope.actorTeacherIds.length === 0 ||
      assignmentScope.allowedClassIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No assigned teaching scope found" },
        { status: 403 },
      );
    }

    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, school_id, class_id, subject_id, teacher_id, total_marks, title")
      .eq("id", body.assignmentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (assignmentError) throw assignmentError;
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const teacherAllowed = assignmentScope.actorTeacherIds.includes(
      String(assignment.teacher_id || ""),
    );
    const classAllowed = assignmentScope.allowedClassIds.includes(
      String(assignment.class_id || ""),
    );
    if (!teacherAllowed || !classAllowed) {
      return NextResponse.json(
        { error: "You are not assigned to this class/assignment" },
        { status: 403 },
      );
    }

    // Publish lock — no draft overwrites after publication.
    const { data: publishedRows, error: publishedError } = await supabaseAdmin
      .from("results")
      .select("id")
      .eq("assignment_id", body.assignmentId)
      .eq("school_id", schoolId)
      .not("published_at", "is", null)
      .limit(1);

    if (publishedError) throw publishedError;
    if (publishedRows && publishedRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "Results for this assignment are already published and cannot be modified",
          locked: true,
        },
        { status: 409 },
      );
    }

    const totalMarks = Number(assignment.total_marks) || 100;
    const studentIds = [...new Set(body.results.map((r) => r.studentId))];

    // School-scope student check (profiles.id and/or students.id).
    const [profilesRes, studentsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("school_id", schoolId)
        .in("id", studentIds),
      supabaseAdmin
        .from("students")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .in("id", studentIds),
    ]);

    const allowed = new Set<string>();
    for (const row of profilesRes.data || []) {
      if (row?.id) allowed.add(String(row.id));
    }
    for (const row of studentsRes.data || []) {
      if (row?.id) allowed.add(String(row.id));
      if (row?.profile_id) allowed.add(String(row.profile_id));
    }

    // Profiles may use profile_id as student_id in results — also match reverse.
    const missing = studentIds.filter((id) => !allowed.has(id));
    if (missing.length) {
      const { data: byProfile } = await supabaseAdmin
        .from("students")
        .select("id, profile_id")
        .eq("school_id", schoolId)
        .in("profile_id", missing);
      for (const row of byProfile || []) {
        if (row?.id) allowed.add(String(row.id));
        if (row?.profile_id) allowed.add(String(row.profile_id));
      }
    }

    const rejected = studentIds.filter((id) => !allowed.has(id));
    if (rejected.length) {
      return NextResponse.json(
        {
          error: "One or more students are outside your school",
          rejectedCount: rejected.length,
        },
        { status: 403 },
      );
    }

    const upsertRows = body.results.map((row) => {
      let score =
        row.score == null || Number.isNaN(Number(row.score))
          ? null
          : Number(row.score);
      if (score != null) {
        score = Math.max(0, Math.min(totalMarks, score));
      }
      const grade =
        row.grade?.trim() ||
        (score != null ? getECZGrade((score / totalMarks) * 100).grade : null);

      return {
        school_id: schoolId,
        assignment_id: body.assignmentId,
        student_id: row.studentId,
        score,
        grade,
        remarks: row.remarks?.trim() || null,
        published_at: null,
        published_by: null,
      };
    });

    const { data: upserted, error: upsertError } = await supabaseAdmin
      .from("results")
      .upsert(upsertRows, {
        onConflict: "student_id,assignment_id",
        ignoreDuplicates: false,
      })
      .select("id, student_id, score, grade");

    if (upsertError) throw upsertError;

    await auditDomainWrite({
      schoolId,
      userId,
      action: "results.draft_saved",
      entityType: "results",
      entityId: body.assignmentId,
      newData: {
        assignmentId: body.assignmentId,
        count: upsertRows.length,
        channel: "mobile",
      },
      ipAddress: ip,
    });
    await invalidateByTag("results");

    const responseBody = {
      success: true,
      data: {
        assignmentId: body.assignmentId,
        saved: (upserted || []).length,
        results: upserted || [],
      },
    };

    if (idempotencyKey) {
      await storeIdempotentResponse(
        { routeKey, schoolId, scopeKey, idempotencyKey },
        hashRequestPayload({
          assignmentId: body.assignmentId,
          results: body.results,
        }),
        200,
        responseBody,
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid results payload", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to save results") },
      { status: 500 },
    );
  }
}
