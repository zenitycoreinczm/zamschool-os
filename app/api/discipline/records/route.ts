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

    // Avoid PostgREST embed/FK-name failures (common cause of 500s for office
    // desks). Load rows plain, then enrich related data in parallel.
    let query = supabaseAdmin
      .from("discipline_records")
      .select("*", { count: "exact" })
      .eq("school_id", schoolId)
      .order("incident_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (studentId) query = query.eq("student_id", studentId);
    if (classId) query = query.eq("class_id", classId);
    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", parseInt(severity, 10));

    const { data, error, count } = await query;
    if (error) {
      // Missing table → empty list instead of hard failure for Guidance/Discipline desks.
      if (error.code === "42P01" || /does not exist|relation/i.test(error.message || "")) {
        const empty = NextResponse.json({
          success: true,
          data: [],
          pagination: { limit, offset, total: 0 },
        });
        return applyEdgeCacheHeaders(empty, "noStore");
      }
      throw error;
    }

    const rows = data || [];
    const studentIds = Array.from(
      new Set(rows.map((r: any) => r.student_id).filter(Boolean)),
    );
    const categoryIds = Array.from(
      new Set(rows.map((r: any) => r.category_id).filter(Boolean)),
    );
    const recordIds = rows.map((r: any) => r.id).filter(Boolean);
    const reporterIds = Array.from(
      new Set(
        rows
          .flatMap((r: any) => [r.reported_by, r.resolved_by])
          .filter(Boolean),
      ),
    );

    const [studentsRes, categoriesRes, actionsRes, reportersRes] =
      await Promise.all([
        studentIds.length
          ? supabaseAdmin
              .from("students")
              .select("id, student_number, profile_id")
              .in("id", studentIds)
          : Promise.resolve({ data: [] as any[] }),
        categoryIds.length
          ? supabaseAdmin
              .from("discipline_categories")
              .select("id, name, severity")
              .in("id", categoryIds)
          : Promise.resolve({ data: [] as any[] }),
        recordIds.length
          ? supabaseAdmin
              .from("discipline_actions")
              .select(
                "id, record_id, action_type, description, action_date, duration_days",
              )
              .in("record_id", recordIds)
          : Promise.resolve({ data: [] as any[] }),
        reporterIds.length
          ? supabaseAdmin
              .from("profiles")
              .select("id, first_name, last_name")
              .in("id", reporterIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

    const studentsById = new Map(
      (studentsRes.data || []).map((s: any) => [s.id, s]),
    );
    const categoriesById = new Map(
      (categoriesRes.data || []).map((c: any) => [c.id, c]),
    );
    const actionsByRecord = new Map<string, any[]>();
    for (const action of actionsRes.data || []) {
      const key = String(action.record_id || "");
      if (!key) continue;
      const list = actionsByRecord.get(key) || [];
      list.push(action);
      actionsByRecord.set(key, list);
    }
    const profilesById = new Map(
      (reportersRes.data || []).map((p: any) => [p.id, p]),
    );

    // Student display names from profiles
    const studentProfileIds = Array.from(
      new Set(
        (studentsRes.data || [])
          .map((s: any) => s.profile_id)
          .filter(Boolean),
      ),
    );
    let studentProfilesById = new Map<
      string,
      { first_name: string | null; last_name: string | null }
    >();
    if (studentProfileIds.length > 0) {
      const { data: studentProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", studentProfileIds);
      studentProfilesById = new Map(
        (studentProfiles || []).map((p: any) => [p.id, p]),
      );
    }

    const enriched = rows.map((record: any) => {
      const student = record.student_id
        ? studentsById.get(record.student_id)
        : null;
      const studentProfile = student?.profile_id
        ? studentProfilesById.get(student.profile_id)
        : null;
      const category = record.category_id
        ? categoriesById.get(record.category_id)
        : null;
      const reporter = record.reported_by
        ? profilesById.get(record.reported_by)
        : null;
      const resolver = record.resolved_by
        ? profilesById.get(record.resolved_by)
        : null;

      return {
        ...record,
        student: student
          ? {
              id: student.id,
              student_number: student.student_number,
              profile_id: student.profile_id,
              first_name: studentProfile?.first_name || null,
              last_name: studentProfile?.last_name || null,
            }
          : null,
        category: category || null,
        reporter: reporter || null,
        resolver: resolver || null,
        actions: actionsByRecord.get(String(record.id)) || [],
      };
    });

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
