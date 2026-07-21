import { NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage, getClientIp, applyRateLimit } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Subjects the teacher can use for results upload, assignments, etc.
 *
 * Sources (union — same idea as teacher bootstrap):
 *   1. teacher_class_subject_assignments (primary teaching load)
 *   2. teacher_subject_specializations
 *   3. lessons (timetable) for their teacher ids / allowed classes
 *
 * Optional ?classId= filters to subjects taught in that class (assignments + lessons).
 * Specializations remain available as a fallback when no class filter is set.
 */
export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId, profileId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const actorProfileId = profileId || userId;
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-subjects:${userId}:${ip}`,
      limit: 120,
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

    const { searchParams } = new URL(req.url);
    const classIdFilter = String(searchParams.get("classId") || "").trim();

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId,
    });

    if (assignmentScope.allowedClassIds.length === 0) {
      const response = NextResponse.json({ success: true, data: [] });
      return applyEdgeCacheHeaders(response, "privateRead");
    }

    if (
      classIdFilter &&
      !assignmentScope.allowedClassIds.includes(classIdFilter)
    ) {
      return NextResponse.json(
        { error: "You are not assigned to this class" },
        { status: 403 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const actorTeacherIds = assignmentScope.actorTeacherIds;
    const allowedClassIds = classIdFilter
      ? [classIdFilter]
      : assignmentScope.allowedClassIds;

    const [assignmentsResult, specializationsResult, lessonsResult] =
      await Promise.all([
        supabaseAdmin
          .from("teacher_class_subject_assignments")
          .select("subject_id, class_id")
          .eq("school_id", schoolId)
          .eq("teacher_profile_id", actorProfileId)
          .in("class_id", allowedClassIds)
          .not("subject_id", "is", null),
        // Specializations are teacher-wide; only use when not filtering by class,
        // or as soft extras when class-filtered list is empty (handled below).
        supabaseAdmin
          .from("teacher_subject_specializations")
          .select("subject_id")
          .eq("school_id", schoolId)
          .eq("teacher_profile_id", actorProfileId)
          .not("subject_id", "is", null),
        actorTeacherIds.length > 0
          ? supabaseAdmin
              .from("lessons")
              .select("subject_id, class_id")
              .eq("school_id", schoolId)
              .in("teacher_id", actorTeacherIds)
              .in("class_id", allowedClassIds)
              .not("subject_id", "is", null)
          : Promise.resolve({ data: [] as { subject_id?: string }[], error: null }),
      ]);

    // Soft-fail missing tables (older tenants) rather than 500.
    const assignmentRows = assignmentsResult.error
      ? []
      : assignmentsResult.data || [];
    const specializationRows = specializationsResult.error
      ? []
      : specializationsResult.data || [];
    const lessonRows = lessonsResult.error ? [] : lessonsResult.data || [];

    const fromClassScoped = new Set<string>();
    for (const row of assignmentRows) {
      if (row?.subject_id) fromClassScoped.add(String(row.subject_id));
    }
    for (const row of lessonRows) {
      if (row?.subject_id) fromClassScoped.add(String(row.subject_id));
    }

    const fromSpecializations = new Set<string>();
    for (const row of specializationRows) {
      if (row?.subject_id) fromSpecializations.add(String(row.subject_id));
    }

    // Prefer class-scoped subjects when a class is selected; fall back to
    // specializations so teachers still see something useful if timetable/
    // assignment rows are incomplete.
    let subjectIds: string[];
    if (classIdFilter) {
      subjectIds =
        fromClassScoped.size > 0
          ? Array.from(fromClassScoped)
          : Array.from(fromSpecializations);
    } else {
      subjectIds = Array.from(
        new Set([...fromClassScoped, ...fromSpecializations]),
      );
    }

    if (subjectIds.length === 0) {
      // Last resort: any school subjects for supervised classes (class teacher
      // may publish across subjects even without explicit rows).
      if (
        classIdFilter &&
        assignmentScope.supervisedClassIds.includes(classIdFilter)
      ) {
        const { data: classSubjects } = await supabaseAdmin
          .from("class_subjects")
          .select("subject_id")
          .eq("class_id", classIdFilter)
          .not("subject_id", "is", null);
        subjectIds = Array.from(
          new Set(
            (classSubjects || [])
              .map((r: { subject_id?: string }) => String(r.subject_id || ""))
              .filter(Boolean),
          ),
        );
      }
    }

    if (subjectIds.length === 0) {
      const response = NextResponse.json({ success: true, data: [] });
      return applyEdgeCacheHeaders(response, "privateRead");
    }

    const { data: subjects, error } = await supabaseAdmin
      .from("subjects")
      .select("id, name, code")
      .eq("school_id", schoolId)
      .in("id", subjectIds)
      .order("name", { ascending: true });

    if (error) throw error;

    const response = NextResponse.json({
      success: true,
      data: subjects || [],
    });
    return applyEdgeCacheHeaders(response, "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load subjects") },
      { status: 500 },
    );
  }
}
