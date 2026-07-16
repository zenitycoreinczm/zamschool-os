import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { enforceRouteAccess } from "@/lib/route-enforcement";
import { createAuditLog } from "@/lib/audit-log";
import { auditDomainWrite } from "@/lib/audit-domain";
import {
  buildTeacherConflictIds,
  findLessonSchedulingConflict,
  validateLessonAssignment,
} from "@/lib/teacher-assignment-contract";
import {
  buildTeacherProfileLookup,
  hydrateTimetableRows,
} from "@/lib/admin-route-hydration.mjs";
import {
  fetchTeacherAssignmentReferences,
  isMissingRelationError,
} from "@/lib/teacher-assignment-references";

const createLessonSchema = z.object({
  title: z.string().optional().nullable(),
  subjectId: z.string().min(1),
  classId: z.string().min(1),
  teacherId: z.string().min(1),
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  room: z.string().optional(),
});

const updateLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional().nullable(),
  subjectId: z.string().min(1).optional(),
  classId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  dayOfWeek: z.number().min(0).max(6).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  room: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "timetable", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const data = await fetchTimetableRows({ schoolId, classId, teacherId });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch timetable") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "timetable",
      featureAction: "create",
      domain: "academic",
      domainAction: "create",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-timetable:${ip}`,
      limit: 50,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createLessonSchema);
    const assignment = await validateLessonMutation({
      schoolId,
      classId: body.classId,
      subjectId: body.subjectId,
      teacherId: body.teacherId,
      dayOfWeek: body.dayOfWeek,
      startTime: body.startTime,
      endTime: body.endTime,
    });
    if (!assignment.ok) {
      return NextResponse.json(
        { error: assignment.error },
        { status: assignment.status },
      );
    }

    // lessons.title is NOT NULL in the DB - UI often omits title (subject-driven).
    const lessonTitle =
      String(body.title || "").trim() ||
      (await resolveSubjectTitle(schoolId, body.subjectId)) ||
      "Lesson";

    const payload: Record<string, any> = {
      school_id: schoolId,
      title: lessonTitle,
      subject_id: body.subjectId,
      class_id: body.classId,
      teacher_id: assignment.data.teacherRowId,
      day_of_week: body.dayOfWeek,
      start_time: body.startTime,
      end_time: body.endTime,
    };
    // room is not on the baseline lessons table; only include if provided and
    // the schema supports it (safeInsertLesson strips unknown columns).
    if (body.room !== undefined && String(body.room || "").trim()) {
      payload.room = String(body.room).trim();
    }

    const data = await safeInsertLesson(payload);

    await createAuditLog({
      schoolId,
      userId: access.context.userId,
      action: "timetable.lesson_created",
      entityType: "lesson",
      entityId: data?.id,
      newData: payload,
      ipAddress: ip,
    });

    // Return UI-ready fields so the client can paint the lesson immediately
    // without waiting on a full list re-fetch / browser cache.
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        teacher_row_id: assignment.data.teacherRowId,
        teacher_profile_id: assignment.data.teacherProfileId,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create lesson") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "timetable",
      featureAction: "update",
      domain: "academic",
      domainAction: "update",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `admin-timetable:${ip}`,
      limit: 50,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateLessonSchema);
    const currentLesson = await fetchLessonRecord(body.id, schoolId);
    if (!currentLesson) {
      return NextResponse.json(
        { error: "Lesson not found in this school" },
        { status: 404 },
      );
    }

    const mergedLesson = {
      classId: body.classId || currentLesson.class_id,
      subjectId: body.subjectId || currentLesson.subject_id,
      teacherId: body.teacherId || currentLesson.teacher_id,
      dayOfWeek: body.dayOfWeek ?? currentLesson.day_of_week,
      startTime: body.startTime || currentLesson.start_time,
      endTime: body.endTime || currentLesson.end_time,
    };

    const assignment = await validateLessonMutation({
      schoolId,
      lessonId: body.id,
      classId: mergedLesson.classId,
      subjectId: mergedLesson.subjectId,
      teacherId: mergedLesson.teacherId,
      dayOfWeek: mergedLesson.dayOfWeek,
      startTime: mergedLesson.startTime,
      endTime: mergedLesson.endTime,
    });
    if (!assignment.ok) {
      return NextResponse.json(
        { error: assignment.error },
        { status: assignment.status },
      );
    }

    const payload: Record<string, any> = {};
    if (body.title !== undefined) {
      const nextTitle = String(body.title || "").trim();
      // Never write NULL into lessons.title (NOT NULL constraint).
      if (nextTitle) {
        payload.title = nextTitle;
      } else if (body.subjectId) {
        payload.title =
          (await resolveSubjectTitle(schoolId, body.subjectId)) || "Lesson";
      }
    } else if (body.subjectId) {
      // Keep title in sync when the subject changes and no title was sent.
      payload.title =
        (await resolveSubjectTitle(schoolId, body.subjectId)) || "Lesson";
    }
    if (body.subjectId) payload.subject_id = body.subjectId;
    if (body.classId) payload.class_id = body.classId;
    if (body.teacherId) payload.teacher_id = assignment.data.teacherRowId;
    if (body.dayOfWeek !== undefined) payload.day_of_week = body.dayOfWeek;
    if (body.startTime) payload.start_time = body.startTime;
    if (body.endTime) payload.end_time = body.endTime;
    if (body.room !== undefined && String(body.room || "").trim()) {
      payload.room = String(body.room).trim();
    }

    const data = await safeUpdateLesson(body.id, schoolId, payload);

    await createAuditLog({
      schoolId,
      userId: access.context.userId,
      action: "timetable.lesson_updated",
      entityType: "lesson",
      entityId: body.id,
      newData: payload,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update lesson") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await enforceRouteAccess(req, {
      allowedRoles: ["ACADEMIC_ADMIN", "SUPER_ADMIN"],
      feature: "timetable",
      featureAction: "delete",
      domain: "academic",
      domainAction: "delete",
    });
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Lesson ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("lessons")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    const ip = getClientIp(req);
    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "timetable.deleted",
      entityType: "lesson",
      entityId: id,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete lesson") },
      { status: 500 },
    );
  }
}

async function fetchTimetableRows(input: {
  schoolId: string;
  classId: string | null;
  teacherId: string | null;
}) {
  let modernQuery = supabaseAdmin
    .from("lessons")
    .select(
      `
      *,
      subjects(name, code),
      classes(name, grades(name, level))
    `,
    )
    .eq("school_id", input.schoolId);

  if (input.classId) {
    modernQuery = modernQuery.eq("class_id", input.classId);
  }

  if (input.teacherId) {
    modernQuery = modernQuery.eq("teacher_id", input.teacherId);
  }

  const modern = await modernQuery
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (!modern.error) {
    return attachTeacherProfiles(modern.data || [], input.schoolId);
  }

  if (!shouldUseLegacyClassSchema(modern.error)) {
    throw modern.error;
  }

  let legacyQuery = supabaseAdmin
    .from("lessons")
    .select(
      `
      *,
      subjects(name, code),
      classes(name, grade_level)
    `,
    )
    .eq("school_id", input.schoolId);

  if (input.classId) {
    legacyQuery = legacyQuery.eq("class_id", input.classId);
  }

  if (input.teacherId) {
    legacyQuery = legacyQuery.eq("teacher_id", input.teacherId);
  }

  const legacy = await legacyQuery
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  if (legacy.error) {
    throw legacy.error;
  }

  const rows = (legacy.data || []).map((row: any) => {
    const classRow = Array.isArray(row?.classes)
      ? row.classes[0]
      : row?.classes;
    const gradeLevel = classRow?.grade_level;

    return {
      ...row,
      classes: classRow
        ? {
            ...classRow,
            grades:
              gradeLevel !== undefined && gradeLevel !== null
                ? {
                    name: `Grade ${gradeLevel}`,
                    level: gradeLevel,
                  }
                : null,
          }
        : null,
    };
  });

  return attachTeacherProfiles(rows, input.schoolId);
}

async function resolveSubjectTitle(schoolId: string, subjectId: string) {
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("name")
    .eq("school_id", schoolId)
    .eq("id", subjectId)
    .maybeSingle();
  if (error) return null;
  const name = String(data?.name || "").trim();
  return name || null;
}

async function safeInsertLesson(payload: Record<string, any>) {
  let working = { ...payload };
  // Hard guarantee for NOT NULL title even if callers forget.
  if (!String(working.title || "").trim()) {
    working.title = "Lesson";
  }
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .insert(working)
      .select()
      .single();

    if (!error) return data;

    const unknown = extractMissingColumn(error.message);
    if (!unknown || !(unknown in working)) {
      throw mapLessonWriteError(error, "Failed to create lesson");
    }
    delete working[unknown];
  }

  throw new Error("Failed to insert lesson");
}

function mapLessonWriteError(error: unknown, fallback: string) {
  const message = String(
    (error as { message?: string | null } | null)?.message || "",
  ).toLowerCase();
  if (
    message.includes("null value") &&
    message.includes("title") &&
    message.includes("not-null")
  ) {
    return new Error(
      "Lesson title is required. Choose a subject so a title can be set automatically.",
    );
  }
  if (message.includes("lessons_teacher_id_fkey") || message.includes("teacher_id")) {
    return new Error(
      "That teacher record is invalid or incomplete. Open People → Teachers and ensure the teacher is fully set up, then try again.",
    );
  }
  if (message.includes("foreign key") || message.includes("violates foreign key")) {
    return new Error(
      "Class, subject, or teacher is missing. Refresh the page and try again.",
    );
  }
  if (error instanceof Error) return error;
  return new Error(fallback);
}

async function safeUpdateLesson(
  id: string,
  schoolId: string,
  payload: Record<string, any>,
) {
  let working = { ...payload };
  for (let i = 0; i < 10; i++) {
    const { data, error } = await supabaseAdmin
      .from("lessons")
      .update(working)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (!error) return data;

    const unknown = extractMissingColumn(error.message);
    if (!unknown || !(unknown in working)) {
      throw mapLessonWriteError(error, "Failed to update lesson");
    }
    delete working[unknown];
  }

  throw new Error("Failed to update lesson");
}

function extractMissingColumn(message?: string) {
  if (!message) return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
}

function shouldUseLegacyClassSchema(
  error:
    | { code?: string | null; message?: string | null; details?: string | null }
    | null
    | undefined,
) {
  const message = String(error?.message || "");
  const details = String(error?.details || "");
  return (
    error?.code === "42703" ||
    error?.code === "PGRST205" ||
    error?.code === "PGRST200" ||
    message.includes("grade_level") ||
    message.includes("grade_id") ||
    message.includes("grades") ||
    details.includes("classes")
  );
}

async function attachTeacherProfiles(rows: any[], schoolId: string) {
  const teacherIds = Array.from(
    new Set(
      (rows || [])
        .map((row) => String(row?.teacher_id || "").trim())
        .filter(Boolean),
    ),
  );

  if (teacherIds.length === 0) {
    return hydrateTimetableRows(rows, {}, []);
  }

  const { lookup: teacherProfileLookup, teacherRows } =
    await fetchTeacherProfileLookup(schoolId, teacherIds);
  return hydrateTimetableRows(rows, teacherProfileLookup, teacherRows);
}

async function fetchTeacherProfileLookup(
  schoolId: string,
  teacherIds: string[],
) {
  const [directProfilesResult, teacherRowsResult] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", teacherIds),
    supabaseAdmin
      .from("teachers")
      .select("id, profile_id")
      .eq("school_id", schoolId),
  ]);

  if (directProfilesResult.error) throw directProfilesResult.error;
  if (
    teacherRowsResult.error &&
    !isMissingRelationError(teacherRowsResult.error)
  ) {
    throw teacherRowsResult.error;
  }

  const teacherRows = (teacherRowsResult.data || []).filter(
    (row: any) =>
      teacherIds.includes(String(row?.id || "")) ||
      teacherIds.includes(String(row?.profile_id || "")),
  );

  const knownProfileIds = new Set(
    (directProfilesResult.data || []).map((profile: any) => String(profile.id)),
  );
  const missingProfileIds = Array.from(
    new Set(
      teacherRows
        .map((row: any) => String(row?.profile_id || "").trim())
        .filter((profileId) => profileId && !knownProfileIds.has(profileId)),
    ),
  );

  let linkedProfiles: any[] = [];
  if (missingProfileIds.length > 0) {
    const linkedProfilesResult = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", missingProfileIds);

    if (linkedProfilesResult.error) throw linkedProfilesResult.error;
    linkedProfiles = linkedProfilesResult.data || [];
  }

  const lookup = buildTeacherProfileLookup({
    teacherIds,
    teacherRows,
    profileRows: [...(directProfilesResult.data || []), ...linkedProfiles],
  });

  return { lookup, teacherRows };
}

async function validateLessonMutation(input: {
  schoolId: string;
  lessonId?: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}) {
  const [classRow, subjectRow, teacherReferences] = await Promise.all([
    fetchSchoolOwnedRow("classes", input.classId, input.schoolId),
    fetchSchoolOwnedRow("subjects", input.subjectId, input.schoolId),
    fetchTeacherAssignmentReferences(input.schoolId, input.teacherId),
  ]);

  const lessonValidation = validateLessonAssignment({
    schoolId: input.schoolId,
    classRow,
    subjectRow,
    teacherId: input.teacherId,
    teacherProfiles: teacherReferences.teacherProfiles,
    teacherRows: teacherReferences.teacherRows,
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
  });

  if (!lessonValidation.ok) {
    return lessonValidation;
  }

  const lessons = await fetchLessonsForConflictCheck({
    schoolId: input.schoolId,
    classId: input.classId,
    teacherIds: buildTeacherConflictIds({
      teacherProfileId: lessonValidation.data.teacherProfileId,
      teacherRows: teacherReferences.teacherRows,
    }),
    dayOfWeek: input.dayOfWeek,
  });

  const conflict = findLessonSchedulingConflict({
    candidate: {
      id: input.lessonId || null,
      class_id: input.classId,
      teacher_id: lessonValidation.data.teacherProfileId,
      subject_id: input.subjectId,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
    },
    lessons,
    excludeLessonId: input.lessonId || null,
  });

  if (conflict) {
    return {
      ok: false as const,
      status: 409,
      error: conflict.error,
    };
  }

  return lessonValidation;
}

async function fetchLessonRecord(id: string, schoolId: string) {
  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      "id, school_id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time",
    )
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchSchoolOwnedRow(
  table: "classes" | "subjects",
  id: string,
  schoolId: string,
) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id, school_id")
    .eq("id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function fetchLessonsForConflictCheck(input: {
  schoolId: string;
  classId: string;
  teacherIds: string[];
  dayOfWeek: number;
}) {
  if (input.teacherIds.length === 0) {
    return [];
  }

  const teacherFilters = input.teacherIds
    .map((teacherId) => `teacher_id.eq.${teacherId}`)
    .join(",");

  const { data, error } = await supabaseAdmin
    .from("lessons")
    .select(
      "id, class_id, teacher_id, subject_id, day_of_week, start_time, end_time",
    )
    .eq("school_id", input.schoolId)
    .eq("day_of_week", input.dayOfWeek)
    .or(`class_id.eq.${input.classId},${teacherFilters}`);

  if (error) throw error;
  return data || [];
}


