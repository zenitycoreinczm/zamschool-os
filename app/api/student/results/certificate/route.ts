import { NextResponse } from "next/server";

import { withPublishedResultsCache } from "@/lib/published-results-read";
import { requireStudentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { nanoid } from "nanoid";

const PERFORMANCE_MAP: Record<string, string> = {
  "A+": "Outstanding",
  A: "Excellent",
  "B+": "Very Good",
  B: "Good",
  "C+": "Satisfactory",
  C: "Fair",
  D: "Pass",
  F: "Fail",
};

function getPerformance(grade: string | null): string {
  if (!grade) return "N/A";
  return PERFORMANCE_MAP[grade.toUpperCase()] || PERFORMANCE_MAP[grade.charAt(0).toUpperCase() + grade.slice(1).toLowerCase()] || "N/A";
}

function getOverallGrade(average: number): string {
  if (average >= 80) return "DISTINCTION";
  if (average >= 65) return "CREDIT";
  if (average >= 50) return "PASS";
  return "FAIL";
}

function generateVerificationCode(studentId: string, examTitle: string, schoolId: string): string {
  const base = `${studentId}-${examTitle}-${schoolId}`;
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const suffix = nanoid(6).toUpperCase();
  const prefix = Math.abs(hash).toString(36).toUpperCase().slice(0, 4);
  return `ZX-${prefix}-${suffix}`;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function GET(req: Request) {
  try {
    const access = await requireStudentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;

    const data = await withPublishedResultsCache(
      `student-cert:${schoolId}:${userId}`,
      () => loadStudentCertificates(userId, schoolId)
    );

    return applyEdgeCacheHeaders(NextResponse.json({ success: true, data }), "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load student certificates") },
      { status: 500 }
    );
  }
}

async function loadStudentCertificates(profileId: string, schoolId: string | null) {
  const { data: studentRecord, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, student_number")
    .eq("school_id", schoolId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (studentError) throw studentError;
  if (!studentRecord) return { exams: [] };

  const studentRowId = studentRecord.id;

  const [{ data: resultRows }, { data: profile }, { data: schoolResult }, { data: classInfo }] = await Promise.all([
    supabaseAdmin
      .from("results")
      .select("id, student_id, assignment_id, score, grade, published_at, published_by")
      .eq("school_id", schoolId)
      .eq("student_id", studentRowId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false }),
    supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", profileId)
      .maybeSingle(),
    supabaseAdmin
      .from("schools")
      .select("name")
      .eq("id", schoolId)
      .maybeSingle(),
    studentRecord.class_id
      ? supabaseAdmin
          .from("classes")
          .select("id, name")
          .eq("id", studentRecord.class_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!resultRows || resultRows.length === 0) return { exams: [] };

  const assignmentIds = Array.from(new Set(resultRows.map((r: any) => r.assignment_id).filter(Boolean)));

  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select("id, title, class_id, subject_id, total_marks")
    .eq("school_id", schoolId)
    .in("id", assignmentIds);

  const assignmentMap = new Map((assignments || []).map((a: any) => [a.id, a]));
  const subjectIds = Array.from(new Set((assignments || []).map((a: any) => a.subject_id).filter(Boolean)));

  const { data: subjects } = subjectIds.length > 0
    ? await supabaseAdmin.from("subjects").select("id, name, code").eq("school_id", schoolId).in("id", subjectIds)
    : { data: [] };

  const subjectMap = new Map((subjects || []).map((s: any) => [s.id, s]));

  const teacherIds = Array.from(new Set(resultRows.map((r: any) => r.published_by).filter(Boolean)));
  let teacherNames = new Map<string, string>();
  if (teacherIds.length > 0) {
    const { data: teachers } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    teacherNames = new Map(
      (teachers || []).map((t: any) => [t.id, [t.first_name, t.last_name].filter(Boolean).join(" ") || "Teacher"])
    );
  }

  const examGroups = new Map<string, {
    examTitle: string;
    results: Array<{ subjectName: string; subjectCode: string; score: number; grade: string; totalMarks: number }>;
    publishedAt: string;
    publishedBy: string;
  }>();

  for (const row of resultRows) {
    const assignment = assignmentMap.get(row.assignment_id);
    if (!assignment) continue;
    const examTitle = assignment.title || "Exam";
    if (!examGroups.has(examTitle)) {
      examGroups.set(examTitle, { examTitle, results: [], publishedAt: row.published_at || "", publishedBy: row.published_by || "" });
    }
    const group = examGroups.get(examTitle)!;
    const subject = subjectMap.get(assignment.subject_id);
    group.results.push({
      subjectName: subject?.name || "Subject",
      subjectCode: subject?.code || "",
      score: row.score == null ? 0 : Number(row.score),
      grade: row.grade || "N/A",
      totalMarks: assignment.total_marks || 100,
    });
    if (row.published_at && row.published_at > group.publishedAt) {
      group.publishedAt = row.published_at;
      group.publishedBy = row.published_by || group.publishedBy;
    }
  }

  const classId = studentRecord.class_id;
  const { data: classStudents } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId || "");

  const studentRowIds = (classStudents || []).map((s: any) => s.id);

  const examTitles = Array.from(examGroups.keys());

  const [allClassResults, allClassAssignments] = await Promise.all([
    studentRowIds.length > 0
      ? supabaseAdmin
          .from("results")
          .select("student_id, assignment_id, score")
          .eq("school_id", schoolId)
          .in("student_id", studentRowIds)
          .then((r) => r.data || [])
      : Promise.resolve([] as any[]),
    examTitles.length > 0
      ? supabaseAdmin
          .from("assignments")
          .select("id, title, total_marks")
          .eq("school_id", schoolId)
          .in("title", examTitles)
          .then((r) => r.data || [])
      : Promise.resolve([] as any[]),
  ]);

  const assignmentsByTitle = new Map<string, { id: string; totalMarks: number }[]>();
  for (const a of allClassAssignments) {
    const title = a.title || "Exam";
    if (!assignmentsByTitle.has(title)) assignmentsByTitle.set(title, []);
    assignmentsByTitle.get(title)!.push({ id: a.id, totalMarks: a.total_marks || 100 });
  }

  const examResults: any[] = [];
  const schoolName = schoolResult?.name || "School";
  const studentName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Student";
  const className = classInfo?.name || "Class";

  for (const [examTitle, group] of examGroups) {
    const subjects = group.results.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    const totalScore = subjects.reduce((sum, s) => sum + s.score, 0);
    const totalPossible = subjects.reduce((sum, s) => sum + s.totalMarks, 0);
    const average = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const overallGrade = getOverallGrade(average);

    const examAssignments = assignmentsByTitle.get(examTitle) || [];
    const examAssignmentIds = new Set(examAssignments.map((a) => a.id));

    const classTotals = new Map<string, number>();
    for (const r of allClassResults) {
      if (!examAssignmentIds.has(r.assignment_id)) continue;
      const current = classTotals.get(r.student_id) || 0;
      classTotals.set(r.student_id, current + (r.score == null ? 0 : Number(r.score)));
    }

    const sortedTotals = Array.from(classTotals.entries()).sort((a, b) => b[1] - a[1]);
    const rank = sortedTotals.findIndex(([sid]) => sid === studentRowId) + 1;
    const classSize = sortedTotals.length || 1;
    const positionStr = rank > 0 ? `${getOrdinal(rank)} of ${classSize}` : "-";

    const verificationCode = generateVerificationCode(studentRowId, examTitle, schoolId || "");

    examResults.push({
      examTitle,
      studentName,
      examNumber: studentRecord.student_number || "-",
      className,
      schoolName,
      year: new Date().getFullYear(),
      publishedAt: group.publishedAt || new Date().toISOString(),
      teacherName: teacherNames.get(group.publishedBy) || "Teacher",
      subjects: subjects.map((s) => ({
        name: s.subjectName,
        code: s.subjectCode,
        score: s.score,
        grade: s.grade,
        totalMarks: s.totalMarks,
        performance: getPerformance(s.grade),
      })),
      totalScore,
      totalPossible,
      average: Math.round(average * 10) / 10,
      overallGrade,
      position: positionStr,
      classSize,
      verificationCode,
    });
  }

  examResults.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  return { exams: examResults };
}
