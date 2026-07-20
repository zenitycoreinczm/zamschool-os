import { NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
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

    const rate = await applyPlatformRateLimit({
      scope: "teacher-results-completeness",
      schoolId,
      req,
      userId,
      preset: "teacherResultsCompleteness",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const examTitle = searchParams.get("examTitle");

    if (!classId)
      return NextResponse.json(
        { error: "classId is required" },
        { status: 400 },
      );
    if (!examTitle)
      return NextResponse.json(
        { error: "examTitle is required" },
        { status: 400 },
      );

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: access.context.profileId || userId,
    });

    if (!assignmentScope.allowedClassIds.includes(classId)) {
      return NextResponse.json(
        { error: "Access denied to this class" },
        { status: 403 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [
      { data: students },
      { data: subjects },
      { data: assignments },
      { data: classes },
    ] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, profile_id, student_number, class_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .order("student_number", { ascending: true }),
      supabaseAdmin
        .from("subjects")
        .select("id, name, code")
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("assignments")
        .select("id, subject_id, title, class_id")
        .eq("school_id", schoolId)
        .eq("class_id", classId)
        .eq("title", examTitle),
      supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("id", classId)
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

    if (!assignments || assignments.length === 0) {
      const response = NextResponse.json({
        success: true,
        data: {
          students: [],
          summary: {
            totalStudents: (students || []).length,
            completeStudents: 0,
            incompleteStudents: (students || []).length,
            expectedSubjectCount: (subjects || []).length,
            uploadedSubjectCount: 0,
          },
          className: classes?.name || "Class",
          examTitle,
        },
      });
      return applyEdgeCacheHeaders(response, "noStore");
    }

    const assignmentIds = assignments.map((a: any) => a.id);

    const { data: results } = await supabaseAdmin
      .from("results")
      .select("student_id, assignment_id, score, grade")
      .eq("school_id", schoolId)
      .in("assignment_id", assignmentIds);

    const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s]));
    const assignmentSubjectMap = new Map(
      (assignments || []).map((a: any) => [a.id, a.subject_id]),
    );

    const resultsByStudent = new Map<
      string,
      Map<string, { score: number | null; grade: string | null }>
    >();
    for (const r of results || []) {
      const subjectId = assignmentSubjectMap.get(r.assignment_id);
      if (!subjectId) continue;

      if (!resultsByStudent.has(r.student_id)) {
        resultsByStudent.set(r.student_id, new Map());
      }
      resultsByStudent.get(r.student_id)!.set(subjectId, {
        score: r.score == null ? null : Number(r.score),
        grade: r.grade || null,
      });
    }

    const profileIds = Array.from(
      new Set((students || []).map((s: any) => s.profile_id).filter(Boolean)),
    );

    let profilesById = new Map<string, any>();
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", profileIds);
      profilesById = new Map((profiles || []).map((p: any) => [p.id, p]));
    }

    const expectedCount = (subjects || []).length;
    let completeCount = 0;

    const studentResults = (students || []).map((s: any) => {
      const profile = profilesById.get(s.profile_id || "");
      const studentResults = resultsByStudent.get(s.id) || new Map();
      const uploadedCount = studentResults.size;
      const isComplete = uploadedCount >= expectedCount && expectedCount > 0;

      if (isComplete) completeCount++;

      const subjectResults = (subjects || []).map((sub: any) => {
        const r = studentResults.get(sub.id);
        return {
          subjectId: sub.id,
          subjectName: sub.name,
          subjectCode: sub.code,
          score: r?.score ?? null,
          grade: r?.grade ?? null,
        };
      });

      const missingSubjects = (subjects || [])
        .filter((sub: any) => !studentResults.has(sub.id))
        .map((sub: any) => sub.name);

      return {
        studentId: s.id,
        studentName:
          [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
          "Student",
        examNumber: s.student_number || "-",
        expectedSubjects: expectedCount,
        uploadedSubjects: uploadedCount,
        isComplete,
        missingSubjects,
        subjects: subjectResults,
      };
    });

    const response = NextResponse.json({
      success: true,
      data: {
        students: studentResults,
        summary: {
          totalStudents: studentResults.length,
          completeStudents: completeCount,
          incompleteStudents: studentResults.length - completeCount,
          expectedSubjectCount: expectedCount,
          uploadedSubjectCount: assignments.length,
        },
        className: classes?.name || "Class",
        examTitle,
      },
    });

    return applyEdgeCacheHeaders(response, "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to check completeness") },
      { status: 500 },
    );
  }
}
