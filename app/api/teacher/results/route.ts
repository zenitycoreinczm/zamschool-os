import { NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { withCache } from "@/lib/enhanced-cache";

type AssignmentRow = {
  id: string;
  title: string | null;
  due_date: string | null;
  total_marks: number | null;
  class_id: string | null;
  subject_id: string | null;
  teacher_id: string | null;
};

type ResultRow = {
  id: string;
  score: number | null;
  grade: string | null;
  remarks: string | null;
  created_at: string | null;
  published_at: string | null;
  published_by: string | null;
  student_id: string | null;
  assignment_id: string | null;
  exam_id: string | null;
};

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const actorProfileId =
      access.context.profileId || access.context.userId;
    const data = await withCache(
      `teacher:results:${schoolId}:${actorProfileId}`,
      () => loadTeacherResults(actorProfileId, schoolId),
      { ttlSeconds: 120, staleWhileRevalidate: 300, tags: ["results"] }
    );

    return jsonResponse({ data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load teacher results") },
      { status: 500 }
    );
  }
}

async function loadTeacherResults(
  actorProfileId: string,
  schoolId: string,
) {
  const assignmentScope = await loadTeacherAssignmentScope({
    schoolId,
    actorProfileId,
  });

  if (
    assignmentScope.actorTeacherIds.length === 0 ||
    assignmentScope.allowedClassIds.length === 0
  ) {
    return [];
  }

  const { data: assignmentRows, error: assignmentError } = await supabaseAdmin
    .from("assignments")
    .select("id, title, due_date, total_marks, class_id, subject_id, teacher_id")
    .eq("school_id", schoolId)
    .in("teacher_id", assignmentScope.actorTeacherIds)
    .in("class_id", assignmentScope.allowedClassIds)
    .order("due_date", { ascending: false });

  if (assignmentError) throw assignmentError;

  const assignments = (assignmentRows || []) as AssignmentRow[];
  const assignmentIds = assignments.map((row) => row.id).filter(Boolean);
  if (assignmentIds.length === 0) {
    return [];
  }

  const [resultsResult, classesResult, subjectsResult] = await Promise.all([
    supabaseAdmin
      .from("results")
      .select("id, score, grade, remarks, created_at, published_at, published_by, student_id, assignment_id, exam_id")
      .in("assignment_id", assignmentIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("classes")
      .select("id, name")
      .eq("school_id", schoolId)
      .in("id", uniqueValues(assignments.map((row) => row.class_id).filter(isNonEmptyString))),
    supabaseAdmin
      .from("subjects")
      .select("id, name")
      .eq("school_id", schoolId)
      .in("id", uniqueValues(assignments.map((row) => row.subject_id).filter(isNonEmptyString))),
  ]);

  if (resultsResult.error) throw resultsResult.error;
  if (classesResult.error) throw classesResult.error;
  if (subjectsResult.error) throw subjectsResult.error;

  const results = (resultsResult.data || []) as ResultRow[];
  const studentIds = uniqueValues(results.map((row) => row.student_id).filter(isNonEmptyString));

  let studentsById = new Map<string, { profile_id: string | null }>();
  let profilesById = new Map<
    string,
    {
      id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    }
  >();

  if (studentIds.length > 0) {
    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id, profile_id")
      .eq("school_id", schoolId)
      .in("id", studentIds);

    if (studentError) throw studentError;

    studentsById = new Map(
      (studentRows || []).map((row: any) => [
        row.id,
        { profile_id: row.profile_id || null },
      ])
    );

    const profileIds = uniqueValues(
      (studentRows || []).map((row: any) => row.profile_id).filter(isNonEmptyString)
    );

    if (profileIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("school_id", schoolId)
        .in("id", profileIds);

      if (profileError) throw profileError;

      profilesById = new Map((profileRows || []).map((row: any) => [row.id, row]));
    }
  }

  const assignmentById = new Map(assignments.map((row) => [row.id, row]));
  const classById = new Map((classesResult.data || []).map((row: any) => [row.id, row]));
  const subjectById = new Map((subjectsResult.data || []).map((row: any) => [row.id, row]));

  return results.map((row) => {
    const assignment = assignmentById.get(row.assignment_id || "");
    const student = studentsById.get(row.student_id || "");
    const profile = student?.profile_id
      ? profilesById.get(student.profile_id)
      : null;
    const score = row.score == null ? null : Number(row.score);
    const gradedAt = score != null || row.grade ? row.created_at : null;

    return {
      id: row.id,
      score,
      grade: row.grade || null,
      remarks: row.remarks || null,
      created_at: row.created_at,
      published_at: row.published_at,
      published_by: row.published_by,
      student_id: row.student_id,
      assignment_id: row.assignment_id,
      exam_id: row.exam_id,
      student: profile
        ? {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
          }
        : null,
      assignments: {
        title: assignment?.title || "Assignment",
        due_date: assignment?.due_date || null,
        total_marks: assignment?.total_marks || 0,
        classes: {
          name: classById.get(assignment?.class_id || "")?.name || "Class",
        },
        subjects: {
          name:
            subjectById.get(assignment?.subject_id || "")?.name ||
            assignment?.title ||
            "Subject",
        },
      },
      submitted_at: row.created_at,
      graded_at: gradedAt,
      status: getResultStatus(row.created_at, gradedAt),
      publish_status: row.published_at ? "published" : "draft",
    };
  });
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "noStore");
}

function getResultStatus(submittedAt: string | null, gradedAt: string | null) {
  if (!submittedAt) return "not-submitted";
  if (!gradedAt) return "pending-grade";
  return "graded";
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
