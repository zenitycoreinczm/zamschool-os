import { NextResponse } from "next/server";

import { withPublishedResultsCache } from "@/lib/published-results-read";
import { requireStudentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const access = await requireStudentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;

    const rl = await applyPlatformRateLimit({ scope: "student-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    const data = await withPublishedResultsCache(
      `student:${schoolId}:${userId}`,
      () => loadPublishedStudentResults(userId, schoolId)
    );

    return applyEdgeCacheHeaders(NextResponse.json({ success: true, data }), "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load student results") },
      { status: 500 }
    );
  }
}

async function loadPublishedStudentResults(profileId: string, schoolId: string | null) {
  const studentRecord = await getStudentRecord(profileId, schoolId);
  if (!studentRecord) {
    return [];
  }

  const { data: resultRows, error: resultError } = await supabaseAdmin
    .from("results")
    .select("id, student_id, assignment_id, exam_id, score, grade, remarks, created_at, published_at, published_by")
    .eq("school_id", schoolId)
    .eq("student_id", studentRecord.id)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (resultError) throw resultError;

  const assignmentIds = Array.from(new Set((resultRows || []).map((row: any) => row.assignment_id).filter(Boolean)));
  const examIds = Array.from(new Set((resultRows || []).map((row: any) => row.exam_id).filter(Boolean)));

  const [assignmentsById, examsById] = await Promise.all([
    getAssignmentsByIds(schoolId, assignmentIds),
    getExamsByIds(schoolId, examIds),
  ]);

  const allClassIds = Array.from(new Set([
    ...Array.from(assignmentsById.values()).map((row: any) => row.class_id),
    ...Array.from(examsById.values()).map((row: any) => row.class_id),
  ].filter(Boolean)));
  const allSubjectIds = Array.from(new Set([
    ...Array.from(assignmentsById.values()).map((row: any) => row.subject_id),
    ...Array.from(examsById.values()).map((row: any) => row.subject_id),
  ].filter(Boolean)));

  const [classById, subjectById] = await Promise.all([
    getClassesById(schoolId, allClassIds),
    getSubjectsById(schoolId, allSubjectIds),
  ]);

  return (resultRows || []).map((row: any) => {
    const assignment = assignmentsById.get(row.assignment_id);
    const exam = !assignment && row.exam_id ? examsById.get(row.exam_id) : null;
    const source = assignment || exam;

    return {
      id: row.id,
      student_id: profileId,
      assignment_id: row.assignment_id,
      exam_id: row.exam_id,
      resultType: row.assignment_id ? "assignment" : row.exam_id ? "exam" : "unknown",
      score: row.score == null ? null : Number(row.score),
      grade: row.grade || null,
      remarks: row.remarks || null,
      created_at: row.created_at,
      published_at: row.published_at,
      published_by: row.published_by,
      assignmentTitle: source?.title || source?.name || "Result",
      className: classById.get(source?.class_id || "")?.name || "Class",
      subjectName: subjectById.get(source?.subject_id || "")?.name || "Subject",
    };
  });
}

async function getStudentRecord(profileId: string, schoolId: string | null) {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function getAssignmentsByIds(schoolId: string | null, assignmentIds: string[]) {
  if (!schoolId || assignmentIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, title, class_id, subject_id")
    .eq("school_id", schoolId)
    .in("id", assignmentIds);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function getClassesById(schoolId: string | null, classIds: string[]) {
  if (!schoolId || classIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function getSubjectsById(schoolId: string | null, subjectIds: string[]) {
  if (!schoolId || subjectIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", subjectIds);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function getExamsByIds(schoolId: string | null, examIds: string[]) {
  if (!schoolId || examIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("exams")
    .select("id, title, name, class_id, subject_id")
    .eq("school_id", schoolId)
    .in("id", examIds);

  if (error) {
    if (isMissingTableError(error)) return new Map<string, any>();
    throw error;
  }
  return new Map((data || []).map((row: any) => [row.id, row]));
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "");
  return error?.code === "42P01" || message.includes("does not exist") || message.includes("schema cache");
}
