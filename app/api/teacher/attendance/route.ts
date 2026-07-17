import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildStudentRosterScope,
  canTeacherAccessLesson,
} from "@/lib/attendance/access";
import { syncAttendanceNotifications } from "@/lib/attendance/sync-notifications";
import {
  buildAttendanceWindow,
  summarizeAttendance,
} from "@/lib/attendance/summary";
import { buildAttendanceUpsertRows } from "@/lib/attendance/upsert";
import {
  detectAttendanceConflict,
  generateConflictMetadata,
} from "@/lib/attendance/conflict";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit-log";

// Keep in sync with lib/attendance/status.ts ATTENDANCE_STATUSES (mobile sends SICK too).
const attendanceStatusSchema = z.enum([
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "SICK",
]);

const createAttendanceSchema = z.object({
  lessonId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session_type: z.string().optional().nullable(),
  statuses: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: attendanceStatusSchema,
        remarks: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "attendance",
      "read",
    );
    if (!perm.ok) return perm.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const requestedClassId = String(searchParams.get("classId") || "").trim();
    const query = String(searchParams.get("query") || "")
      .trim()
      .toLowerCase();
    const window = buildAttendanceWindow(
      searchParams.get("range"),
      searchParams.get("endDate"),
    );

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    const allowedClassIds = requestedClassId
      ? assignmentScope.allowedClassIds.filter(
          (classId) => classId === requestedClassId,
        )
      : assignmentScope.allowedClassIds;

    if (allowedClassIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          window,
          summary: {
            totalRecords: 0,
            classes: 0,
            students: 0,
            ...summarizeAttendance([]),
          },
          classOptions: [],
          records: [],
        },
      });
    }

    const [classMap, attendanceRows] = await Promise.all([
      getClassesByIds(schoolId, allowedClassIds),
      loadAttendanceWindowRows({
        schoolId,
        classIds: allowedClassIds,
        startDate: window.startDate,
        endDate: window.endDate,
      }),
    ]);

    const studentMap = await getStudentsByIds(
      schoolId,
      uniqueValues(attendanceRows.map((row) => row.student_id).filter(Boolean)),
    );

    const records = attendanceRows
      .map((row) => {
        const student = studentMap.get(row.student_id || "");
        const classRow = classMap.get(row.class_id || "");
        const status = normalizeAttendanceStatus(row.status);
        const date = String(row.record_date || "").trim();

        return {
          id: row.id,
          date,
          classId: row.class_id || "",
          className: buildClassLabel(classRow),
          studentId: row.student_id || "",
          studentName: buildDisplayName(student?.profile, "Student"),
          admissionNumber: student?.student_number || null,
          email: student?.profile?.email || null,
          status,
          remarks: row.remarks || row.notes || null,
          sessionName: row.session_name || "Lesson",
          sessionTime: row.session_time || null,
          recordedAt: row.created_at || null,
        };
      })
      .filter((row) => {
        if (!query) return true;
        return [
          row.className,
          row.studentName,
          row.admissionNumber,
          row.email,
          row.sessionName,
          row.status,
          row.remarks,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);
      });

    const summary = summarizeAttendance(records);

    return NextResponse.json({
      success: true,
      data: {
        window,
        summary: {
          totalRecords: records.length,
          classes: uniqueValues(
            records.map((row) => row.classId).filter(Boolean),
          ).length,
          students: uniqueValues(
            records.map((row) => row.studentId).filter(Boolean),
          ).length,
          ...summary,
        },
        classOptions: Array.from(classMap.entries()).map(([id, value]) => ({
          id,
          label: buildClassLabel(value),
        })),
        records,
      },
    });
  } catch (error: unknown) {
    console.error("Teacher attendance GET error", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load attendance history") },
      { status: 500 },
    );
  }
}

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
      scope: "teacher-attendance-write",
      schoolId,
      req,
      userId,
      preset: "teacherAttendanceWrite",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const body = await parseJsonWithSchema(req, createAttendanceSchema);

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    const supabaseAdmin = getSupabaseAdmin();

    // ── Parallelize lesson + class fetch ──────────────────────────────────
    // We need the lesson first to know the class_id, but we can fetch
    // the lesson and then run class + roster + existing-attendance in parallel.
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select(
        `
        id,
        school_id,
        class_id,
        teacher_id,
        subject_id,
        title,
        start_time,
        end_time,
        subjects(name, code)
      `,
      )
      .eq("id", body.lessonId)
      .maybeSingle();

    if (lessonError) throw lessonError;
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const baseSessionName =
      lesson.title || getSubjectField(lesson.subjects, "name") || "Lesson";
    const sessionType =
      body.session_type || detectSessionType(lesson.start_time);
    const sessionName = `${sessionType} - ${baseSessionName}`;

    // ── Fetch class, roster, and existing attendance in parallel ──────────
    const [classRow, rosterRows, existingAttendance] = await Promise.all([
      getClassById({ schoolId, classId: lesson.class_id }),
      getStudentsByClassId({ schoolId, classId: lesson.class_id }),
      loadExistingAttendance({
        schoolId,
        classId: lesson.class_id,
        date: body.date,
        sessionName,
      }),
    ]);

    const hasLessonAccess = assignmentScope.actorTeacherIds.some(
      (actorTeacherId) =>
        canTeacherAccessLesson({
          actorId: actorTeacherId,
          lessonTeacherId: lesson.teacher_id,
          classSupervisorId: classRow?.supervisor_id || null,
          lessonSchoolId: lesson.school_id,
          actorSchoolId: schoolId,
          classId: lesson.class_id,
          allowedClassIds: assignmentScope.allowedClassIds,
        }),
    );

    if (!hasLessonAccess) {
      return NextResponse.json(
        { error: "Forbidden - lesson access denied" },
        { status: 403 },
      );
    }

    const rosterStudentIds = buildStudentRosterScope({
      classId: lesson.class_id,
      students: rosterRows.map((row) => ({
        id: row.id,
        classId: row.class_id,
      })),
    });

    if (rosterStudentIds.length === 0) {
      return NextResponse.json(
        { error: "No students are assigned to this lesson's class" },
        { status: 400 },
      );
    }

    const submittedIds = body.statuses.map((row) => row.studentId);
    const duplicateIds = getDuplicateIds(submittedIds);
    if (duplicateIds.length > 0) {
      return NextResponse.json(
        {
          error: `Duplicate student statuses submitted: ${duplicateIds.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const submittedIdSet = new Set(submittedIds);
    const rosterIdSet = new Set(rosterStudentIds);
    const missingStudentIds = rosterStudentIds.filter(
      (studentId) => !submittedIdSet.has(studentId),
    );
    if (missingStudentIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Attendance is incomplete. Every roster student must have a submitted status.",
          missingStudentIds,
        },
        { status: 400 },
      );
    }

    const unexpectedStudentIds = submittedIds.filter(
      (studentId) => !rosterIdSet.has(studentId),
    );
    if (unexpectedStudentIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Attendance payload includes students outside the assigned lesson roster.",
          unexpectedStudentIds,
        },
        { status: 400 },
      );
    }

    // Lock check: if records exist and are outside editable window, block edits
    const existingTimestamps = Array.from(existingAttendance.values())
      .map((r) => r.created_at)
      .filter(Boolean) as string[];

    if (existingTimestamps.length > 0) {
      const allLocked = existingTimestamps.every(
        (ts) => !isWithinEditableWindow(ts),
      );
      if (allLocked) {
        return NextResponse.json(
          {
            error: `This roll call was submitted ${EDITABLE_WINDOW_MINUTES}+ minutes ago and is now locked. Contact an admin to make changes.`,
            locked: true,
          },
          { status: 423 },
        );
      }
    }

    // Detect and log conflicts
    const conflicts: any[] = [];
    for (const status of body.statuses) {
      const existing = existingAttendance.get(status.studentId);
      const conflict = detectAttendanceConflict(
        existing || null,
        status.status,
        userId,
      );
      if (conflict.hasConflict) {
        conflicts.push({
          studentId: status.studentId,
          ...generateConflictMetadata(conflict, lesson.id, status.studentId),
        });
      }
    }

    if (conflicts.length > 0) {
      console.log("Attendance conflicts detected:", conflicts);
    }

    const rows = buildAttendanceUpsertRows({
      schoolId,
      classId: lesson.class_id,
      markedBy: userId,
      date: body.date,
      sessionName,
      sessionTime: lesson.start_time,
      statuses: body.statuses,
    });

    // DB has attendance_idempotent_slot_uq on
    // (school_id, student_id, class_id, attendance_date) — one mark per
    // student/class/day. Upserting on session_name creates a second row and
    // 500s with 23505. Always target the day slot so re-saves update in place.
    let savedRows: unknown[] | null = null;
    let saveError: { code?: string; message?: string } | null = null;

    const primary = await supabaseAdmin
      .from("attendance")
      .upsert(rows, {
        onConflict: "school_id,student_id,class_id,attendance_date",
      })
      .select();
    savedRows = primary.data;
    saveError = primary.error;

    if (saveError) {
      // Fallback for schemas that only have the session-level unique index.
      const fallback = await supabaseAdmin
        .from("attendance")
        .upsert(rows, {
          onConflict:
            "school_id,class_id,student_id,attendance_date,session_name",
        })
        .select();
      if (!fallback.error) {
        savedRows = fallback.data;
        saveError = null;
      } else {
        // Last resort: update existing day rows, then insert missing.
        const repaired = await repairAttendanceDayRows({
          schoolId,
          classId: lesson.class_id,
          date: body.date,
          rows,
        });
        if (repaired.error) {
          throw repaired.error;
        }
        savedRows = repaired.data;
        saveError = null;
      }
    }

    if (saveError) throw saveError;

    await createAuditLog({
      schoolId,
      userId,
      action: "attendance.marked",
      entityType: "attendance",
      entityId: lesson.class_id,
      newData: {
        lessonId: lesson.id,
        classId: lesson.class_id,
        date: body.date,
        count: savedRows?.length || rows.length,
      },
    });

    // ── Defer notifications (non-blocking) ────────────────────────────────
    // Notifications don't affect the save; fire-and-forget so the teacher
    // gets a fast response. Errors are logged, not surfaced.
    const notificationPromise = syncAttendanceNotifications({
      schoolId,
      teacherId: userId,
      lesson,
      classRow,
      rosterRows,
      statuses: body.statuses,
      date: body.date,
    }).catch((err) => {
      console.error("[attendance] notification fan-out failed:", err);
      return {
        parentCount: 0,
        notificationCount: 0,
        reason: "Notification fan-out failed",
      };
    });

    // Await so the toast can report accurate parent notify counts.
    const notificationDelivery = await notificationPromise;

    return NextResponse.json({
      success: true,
      data: {
        lessonId: lesson.id,
        classId: lesson.class_id,
        savedCount: savedRows?.length || rows.length,
        date: body.date,
        parentsNotified: notificationDelivery.parentCount,
        notificationsQueued: notificationDelivery.notificationCount,
        notifyReason:
          (notificationDelivery as { reason?: string }).reason || null,
        concernMarks:
          (notificationDelivery as { concernMarks?: number }).concernMarks ??
          null,
        linkedParents:
          (notificationDelivery as { linkedParents?: number }).linkedParents ??
          null,
        conflicts: conflicts.length > 0 ? conflicts : undefined,
      },
    });
  } catch (error: unknown) {
    console.error("Teacher attendance POST error", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to save attendance") },
      { status: 500 },
    );
  }
}

/**
 * When unique indexes disagree (day-slot vs session-slot), update existing
 * day rows in place and insert only students who have no row yet.
 */
async function repairAttendanceDayRows(input: {
  schoolId: string;
  classId: string;
  date: string;
  rows: Array<Record<string, unknown>>;
}): Promise<{ data: unknown[] | null; error: unknown | null }> {
  const supabaseAdmin = getSupabaseAdmin();
  const studentIds = input.rows
    .map((row) => String(row.student_id || "").trim())
    .filter(Boolean);

  const existing = await supabaseAdmin
    .from("attendance")
    .select("id, student_id")
    .eq("school_id", input.schoolId)
    .eq("class_id", input.classId)
    .eq("attendance_date", input.date)
    .in("student_id", studentIds);

  if (existing.error) {
    // Try date column if attendance_date filter fails
    const byDate = await supabaseAdmin
      .from("attendance")
      .select("id, student_id")
      .eq("school_id", input.schoolId)
      .eq("class_id", input.classId)
      .eq("date", input.date)
      .in("student_id", studentIds);
    if (byDate.error) {
      return { data: null, error: byDate.error };
    }
    return applyRepairRows(supabaseAdmin, input.rows, byDate.data || []);
  }

  return applyRepairRows(supabaseAdmin, input.rows, existing.data || []);
}

async function applyRepairRows(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  rows: Array<Record<string, unknown>>,
  existing: Array<{ id: string; student_id: string }>,
): Promise<{ data: unknown[] | null; error: unknown | null }> {
  const existingByStudent = new Map(
    existing.map((row) => [String(row.student_id), row.id]),
  );
  const toUpdate: Array<Record<string, unknown> & { id: string }> = [];
  const toInsert: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const studentId = String(row.student_id || "").trim();
    const existingId = existingByStudent.get(studentId);
    if (existingId) {
      toUpdate.push({ ...row, id: existingId });
    } else {
      toInsert.push(row);
    }
  }

  const saved: unknown[] = [];

  for (const row of toUpdate) {
    const { id, ...patch } = row;
    const result = await supabaseAdmin
      .from("attendance")
      .update(patch)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (result.error) {
      return { data: null, error: result.error };
    }
    if (result.data) saved.push(result.data);
  }

  if (toInsert.length > 0) {
    const result = await supabaseAdmin
      .from("attendance")
      .insert(toInsert)
      .select();
    if (result.error) {
      return { data: null, error: result.error };
    }
    if (Array.isArray(result.data)) saved.push(...result.data);
  }

  return { data: saved, error: null };
}

async function getStudentsByClassId(input: {
  schoolId: string;
  classId: string;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, school_id, student_number")
    .eq("school_id", input.schoolId)
    .eq("class_id", input.classId)
    .order("student_number", { ascending: true });

  if (studentsError) throw studentsError;

  const profileIds = Array.from(
    new Set((students || []).map((row: any) => row.profile_id).filter(Boolean)),
  );

  let profileById = new Map<string, any>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", profileIds);

    if (profilesError) throw profilesError;
    profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  }

  return (students || []).map((row: any) => ({
    ...row,
    profile: profileById.get(row.profile_id || "") || null,
  }));
}

async function getStudentsByIds(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) {
    return new Map<string, any>();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: students, error: studentsError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, student_number")
    .eq("school_id", schoolId)
    .in("id", studentIds);

  if (studentsError) throw studentsError;

  const profileIds = Array.from(
    new Set((students || []).map((row: any) => row.profile_id).filter(Boolean)),
  );

  let profileById = new Map<string, any>();
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", profileIds);

    if (profilesError) throw profilesError;
    profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  }

  return new Map(
    (students || []).map((row: any) => [
      row.id,
      {
        ...row,
        profile: profileById.get(row.profile_id || "") || null,
      },
    ]),
  );
}

async function loadAttendanceWindowRows(input: {
  schoolId: string;
  classIds: string[];
  startDate: string;
  endDate: string;
}) {
  if (input.classIds.length === 0) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();
  const queryAttempts = [
    async () => {
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .select(
          "id, class_id, student_id, attendance_date, status, remarks, notes, session_name, session_time, created_at",
        )
        .eq("school_id", input.schoolId)
        .in("class_id", input.classIds)
        .gte("attendance_date", input.startDate)
        .lte("attendance_date", input.endDate)
        .order("attendance_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        record_date: row.attendance_date,
      }));
    },
    async () => {
      const { data, error } = await supabaseAdmin
        .from("attendance")
        .select(
          "id, class_id, student_id, date, status, remarks, notes, session_name, session_time, created_at",
        )
        .eq("school_id", input.schoolId)
        .in("class_id", input.classIds)
        .gte("date", input.startDate)
        .lte("date", input.endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        record_date: row.date,
      }));
    },
  ];

  for (const runQuery of queryAttempts) {
    try {
      return await runQuery();
    } catch {
      continue;
    }
  }

  return [];
}

async function getClassById(input: { schoolId: string; classId: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const legacy = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level, supervisor_id")
    .eq("school_id", input.schoolId)
    .eq("id", input.classId)
    .maybeSingle();

  if (!legacy.error) {
    return legacy.data;
  }

  const modern = await supabaseAdmin
    .from("classes")
    .select("id, name, supervisor_id, grades(name, level)")
    .eq("school_id", input.schoolId)
    .eq("id", input.classId)
    .maybeSingle();

  if (modern.error) throw modern.error;
  return modern.data;
}

async function getClassesByIds(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, any>();
  }

  const supabaseAdmin = getSupabaseAdmin();
  const legacy = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level, supervisor_id")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!legacy.error) {
    return new Map((legacy.data || []).map((row: any) => [row.id, row]));
  }

  const modern = await supabaseAdmin
    .from("classes")
    .select("id, name, supervisor_id, grades(name, level)")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (modern.error) throw modern.error;
  return new Map((modern.data || []).map((row: any) => [row.id, row]));
}

function getDuplicateIds(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    } else {
      seen.add(id);
    }
  }

  return Array.from(duplicates);
}

function buildDisplayName(
  row:
    | {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
  fallback: string,
) {
  return (
    [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
    row?.email ||
    fallback
  );
}

function normalizeAttendanceStatus(status: string | null | undefined) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  if (
    normalized === "PRESENT" ||
    normalized === "ABSENT" ||
    normalized === "LATE" ||
    normalized === "EXCUSED"
  ) {
    return normalized;
  }
  return normalized || "UNMARKED";
}

function buildClassLabel(classRow: any) {
  const className =
    typeof classRow?.name === "string" ? classRow.name.trim() : "";
  const gradeName =
    typeof classRow?.grades?.name === "string"
      ? classRow.grades.name.trim()
      : buildGradeLevelLabel(classRow?.grade_level);

  return (
    [gradeName, className].filter(Boolean).join(" - ") || className || "Class"
  );
}

function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : "";
}

function getSubjectField(
  subject:
    | { name?: string | null; code?: string | null }
    | Array<{ name?: string | null; code?: string | null }>
    | null
    | undefined,
  field: "name" | "code",
) {
  if (Array.isArray(subject)) {
    return subject[0]?.[field] || null;
  }

  return subject?.[field] || null;
}

async function loadExistingAttendance(input: {
  schoolId: string;
  classId: string;
  date: string;
  sessionName: string;
  sessionTime?: string | null;
}) {
  const supabaseAdmin = getSupabaseAdmin();
  // Don't filter by session_time - the unique constraint
  // (attendance_roll_call_unique) doesn't include it, and NULL ≠ "" in
  // Postgres would silently break the lookup. Session name is the
  // distinguishing key (e.g. "Morning - Math" vs "Afternoon - Math").
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("student_id, created_at, recorded_by, status")
    .eq("school_id", input.schoolId)
    .eq("class_id", input.classId)
    .eq("attendance_date", input.date)
    .eq("session_name", input.sessionName);

  if (error) throw error;

  const map = new Map<
    string,
    {
      created_at: string | null;
      recorded_by: string | null;
      status: string | null;
    }
  >();
  for (const row of data || []) {
    map.set(row.student_id, {
      created_at: row.created_at,
      recorded_by: row.recorded_by,
      status: row.status,
    });
  }
  return map;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const EDITABLE_WINDOW_MINUTES = 30;

function isWithinEditableWindow(createdAt: string | null | undefined): boolean {
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (isNaN(created)) return true;
  const now = Date.now();
  const elapsed = (now - created) / 1000 / 60;
  return elapsed <= EDITABLE_WINDOW_MINUTES;
}

function detectSessionType(startTime: string | null | undefined): string {
  if (!startTime) return "Morning";
  const hour = parseInt(startTime.split(":")[0] || "0", 10);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
