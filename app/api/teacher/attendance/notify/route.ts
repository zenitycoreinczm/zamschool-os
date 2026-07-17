import { NextResponse } from "next/server";
import { z } from "zod";

import { enqueueNotifications } from "@/lib/notification-enqueue";
import { requireTeacherContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const alertSchema = z.object({
  studentId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  parentIds: z.array(z.string()).optional(),
  status: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  escalate: z.boolean().optional(),
  missCountToday: z.number().optional(),
  savedAt: z.string().optional().nullable(),
});

const notifySchema = z.object({
  lessonId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  alerts: z.array(alertSchema).min(1),
});

/**
 * Explicit parent re-notify after roll call (mobile "Send to parents").
 * Fan-out in-app notification rows for linked parent profile ids.
 */
export async function POST(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "attendance",
      "create",
    );
    if (!perm.ok) return perm.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "teacher-attendance-notify",
      schoolId,
      req,
      userId,
      preset: "teacherAttendanceWrite",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const body = await parseJsonWithSchema(req, notifySchema);
    const supabaseAdmin = getSupabaseAdmin();

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id, school_id, teacher_id, class_id, title, start_time")
      .eq("id", body.lessonId)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (!lesson || String(lesson.school_id) !== String(schoolId)) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Resolve parent profile ids when the client only has student ids.
    const studentIds = Array.from(
      new Set(body.alerts.map((a) => a.studentId).filter(Boolean)),
    );
    const parentProfileIdsByStudent = await loadParentProfileIds(
      supabaseAdmin,
      schoolId,
      studentIds,
    );

    const payloads: Array<{
      user_id: string;
      dedupe_key: string;
      title: string;
      message: string;
      type: string;
    }> = [];

    for (const alert of body.alerts) {
      const fromClient = [
        ...(Array.isArray(alert.parentIds) ? alert.parentIds : []),
        alert.parentId || "",
      ]
        .map((id) => String(id || "").trim())
        .filter(Boolean);

      const resolved = Array.from(
        new Set([
          ...fromClient,
          ...(parentProfileIdsByStudent.get(alert.studentId) || []),
        ]),
      ).slice(0, 2);

      for (const parentProfileId of resolved) {
        const statusKey = String(alert.status || "update").toUpperCase();
        payloads.push({
          user_id: parentProfileId,
          dedupe_key: [
            parentProfileId,
            alert.studentId,
            body.lessonId,
            body.date,
            statusKey,
            alert.escalate ? "urgent" : "standard",
          ].join(":"),
          title: alert.title,
          message: alert.body,
          type: alert.escalate ? "attendance_urgent" : "attendance",
        });
      }
    }

    if (payloads.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          notified: 0,
          notificationCount: 0,
          message:
            "No linked parents found for the selected students. Link parents in admin first.",
        },
      });
    }

    await enqueueNotifications(schoolId, payloads);

    return NextResponse.json({
      success: true,
      data: {
        notified: new Set(payloads.map((p) => p.user_id)).size,
        notificationCount: payloads.length,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    console.error("Teacher attendance notify error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to notify parents") },
      { status: 500 },
    );
  }
}

async function loadParentProfileIds(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  schoolId: string,
  studentIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!studentIds.length) return result;

  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .in("id", studentIds);

  if (studentsError) throw studentsError;

  const profileIds = (students || [])
    .map((row: { profile_id?: string | null }) => row.profile_id)
    .filter(Boolean) as string[];
  const linkKeys = Array.from(new Set([...studentIds, ...profileIds]));

  const { data: links, error: linksError } = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .in("student_id", linkKeys);

  if (linksError) throw linksError;
  if (!links?.length) return result;

  const parentIds = Array.from(
    new Set(links.map((row: { parent_id: string }) => row.parent_id).filter(Boolean)),
  );

  const { data: parents, error: parentsError } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .in("id", parentIds);

  if (parentsError) throw parentsError;

  const profileByParentId = new Map<string, string>();
  for (const row of parents || []) {
    if (row.id && row.profile_id) {
      profileByParentId.set(String(row.id), String(row.profile_id));
    }
  }

  const studentRowByKey = new Map<string, string>();
  for (const row of students || []) {
    studentRowByKey.set(String(row.id), String(row.id));
    if (row.profile_id) {
      studentRowByKey.set(String(row.profile_id), String(row.id));
    }
  }

  for (const link of links) {
    const studentRowId = studentRowByKey.get(String(link.student_id));
    const parentProfileId = profileByParentId.get(String(link.parent_id));
    if (!studentRowId || !parentProfileId) continue;
    const existing = result.get(studentRowId) || [];
    if (!existing.includes(parentProfileId)) {
      existing.push(parentProfileId);
    }
    result.set(studentRowId, existing.slice(0, 2));
  }

  return result;
}
