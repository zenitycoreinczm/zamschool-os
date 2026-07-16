import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminContext, requireTeacherContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  parseJsonWithSchema,
  safeErrorMessage,
  getClientIp,
} from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";
import { enqueueNotifications } from "@/lib/notification-enqueue";
import {
  buildDisciplineRecordNotificationPayloads,
  buildDisciplineStatusChangeNotificationPayloads,
} from "@/lib/discipline-notifications";
import { authorizeWorkflowTransition } from "@/lib/workflow-states";

const createRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  incidentDate: z.string().optional(),
  incidentLocation: z.string().max(200).optional(),
  severity: z.number().int().min(1).max(5).optional(),
});

const updateRecordSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  incidentDate: z.string().optional(),
  incidentLocation: z.string().max(200).optional(),
  severity: z.number().int().min(1).max(5).optional(),
  status: z
    .enum(["open", "investigating", "resolved", "escalated", "closed"])
    .optional(),
  resolutionNotes: z.string().max(2000).optional(),
});

export async function GET(req: Request) {
  try {
    // Admins and teachers can both read discipline records.
    // Database RLS policies scope teachers to their assigned classes.
    let access = await requireAdminContext(req);
    if (!access.ok) {
      access = await requireTeacherContext(req);
    }
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classId = searchParams.get("classId");
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "100", 10),
      500,
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let query = supabaseAdmin
      .from("discipline_records")
      .select(
        `
        *,
        student:students(id, student_number, profile_id),
        category:discipline_categories(id, name, severity),
        reporter:profiles!discipline_records_reported_by_fkey(id, first_name, last_name),
        resolver:profiles!discipline_records_resolved_by_fkey(id, first_name, last_name),
        actions:discipline_actions(*)
      `,
      )
      .eq("school_id", schoolId)
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (studentId) query = query.eq("student_id", studentId);
    if (classId) query = query.eq("class_id", classId);
    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", parseInt(severity, 10));

    const { data, error, count } = await query;
    if (error) throw error;

    // Enrich with student profile names
    const profileIds = Array.from(
      new Set(
        (data || []).map((r: any) => r.student?.profile_id).filter(Boolean),
      ),
    );

    let profilesById: Record<
      string,
      { first_name: string | null; last_name: string | null }
    > = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", profileIds);
      profilesById = Object.fromEntries(
        (profiles || []).map((p: any) => [p.id, p]),
      );
    }

    const enriched = (data || []).map((record: any) => ({
      ...record,
      student: record.student
        ? {
            ...record.student,
            first_name:
              profilesById[record.student.profile_id]?.first_name || null,
            last_name:
              profilesById[record.student.profile_id]?.last_name || null,
          }
        : null,
    }));

    const response = NextResponse.json({
      success: true,
      data: enriched,
      pagination: { limit, offset, total: count ?? enriched.length },
    });

    return applyEdgeCacheHeaders(response, "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load discipline records") },
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

    const body = await parseJsonWithSchema(req, createRecordSchema);

    // Verify student exists in this school
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, class_id, profile_id")
      .eq("id", body.studentId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const classId = body.classId || student.class_id;

    const payload = {
      school_id: schoolId,
      student_id: body.studentId,
      class_id: classId || null,
      category_id: body.categoryId || null,
      reported_by: userId,
      title: body.title,
      description: body.description || null,
      incident_date:
        body.incidentDate || new Date().toISOString().split("T")[0],
      incident_location: body.incidentLocation || null,
      severity: body.severity || 1,
      status: "open" as const,
    };

    const { data, error } = await supabaseAdmin
      .from("discipline_records")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId,
      action: "discipline.created",
      entityType: "discipline_records",
      entityId: data.id,
      newData: {
        studentId: body.studentId,
        title: body.title,
        severity: body.severity || 1,
        classId,
      },
      ipAddress: getClientIp(req),
    });

    // Notify student + linked parents
    try {
      const reporterProfile = await supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      const reporterName =
        [reporterProfile?.data?.first_name, reporterProfile?.data?.last_name]
          .filter(Boolean)
          .join(" ") || "Staff";

      const notifications = await buildDisciplineRecordNotificationPayloads({
        schoolId,
        studentId: body.studentId,
        studentProfileId: student.profile_id || "",
        recordId: data.id,
        title: body.title,
        severity: body.severity || 1,
        status: "open",
        incidentDate: payload.incident_date,
        reportedByName: reporterName,
      });
      if (notifications.length > 0) {
        await enqueueNotifications(schoolId, notifications);
      }
    } catch {
      // Non-critical - don't fail the request
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create discipline record") },
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

    const body = await parseJsonWithSchema(req, updateRecordSchema);
    const { id, ...updates } = body;

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined)
      updatePayload.description = updates.description;
    if (updates.incidentDate !== undefined)
      updatePayload.incident_date = updates.incidentDate;
    if (updates.incidentLocation !== undefined)
      updatePayload.incident_location = updates.incidentLocation;
    if (updates.severity !== undefined)
      updatePayload.severity = updates.severity;
    if (updates.status !== undefined) {
      // Validate discipline workflow transition
      const { data: existing } = await supabaseAdmin
        .from("discipline_records")
        .select("status")
        .eq("id", id)
        .eq("school_id", schoolId)
        .maybeSingle();

      const currentStatus = String(existing?.status || "open").toLowerCase();
      const newStatus = updates.status.toLowerCase();

      if (currentStatus !== newStatus) {
        const auth = authorizeWorkflowTransition(
          "discipline",
          currentStatus,
          newStatus,
          access.context.role,
        );
        if (!auth.allowed) {
          return NextResponse.json(
            { error: auth.reason || "Invalid discipline status transition" },
            { status: 403 },
          );
        }
      }
      updatePayload.status = updates.status;
    }
    if (updates.categoryId !== undefined)
      updatePayload.category_id = updates.categoryId;
    if (updates.resolutionNotes !== undefined)
      updatePayload.resolution_notes = updates.resolutionNotes;

    // If resolving, set resolved_by and resolved_at
    if (updates.status === "resolved" || updates.status === "closed") {
      updatePayload.resolved_by = userId;
      updatePayload.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from("discipline_records")
      .update(updatePayload)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "discipline.updated",
      entityType: "discipline_records",
      entityId: id,
      newData: updatePayload,
      ipAddress: getClientIp(req),
    });

    // Notify on status change
    if (updates.status) {
      try {
        const { data: record } = await supabaseAdmin
          .from("discipline_records")
          .select("student_id, title")
          .eq("id", id)
          .eq("school_id", schoolId)
          .maybeSingle();

        if (record) {
          const { data: student } = await supabaseAdmin
            .from("students")
            .select("profile_id")
            .eq("id", record.student_id)
            .eq("school_id", schoolId)
            .maybeSingle();

          const resolverProfile = await supabaseAdmin
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", userId)
            .maybeSingle();
          const resolverName =
            [
              resolverProfile?.data?.first_name,
              resolverProfile?.data?.last_name,
            ]
              .filter(Boolean)
              .join(" ") || "Staff";

          if (student?.profile_id) {
            const notifications =
              await buildDisciplineStatusChangeNotificationPayloads({
                schoolId,
                studentId: record.student_id,
                studentProfileId: student.profile_id,
                recordId: id,
                title: record.title,
                newStatus: updates.status,
                resolvedByName: resolverName,
              });
            if (notifications.length > 0) {
              await enqueueNotifications(schoolId, notifications);
            }
          }
        }
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update discipline record") },
      { status: 500 },
    );
  }
}
