import { NextResponse } from "next/server";

import { withPublishedResultsCache } from "@/lib/published-results-read";
import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, buildDisplayName } from "@/lib/parent-route-utils";
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

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const selectedStudentId = searchParams.get("studentId");
    const groupByExam = searchParams.get("groupBy") === "exam";

    const parentRecord = await getParentRecord({ profileId: userId, schoolId });

    if (!parentRecord) {
      return jsonResponse({ success: true, data: groupByExam ? { exams: [] } : [] });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: userId,
      schoolId,
      includeRowMappings: true,
    });

    if (linked.profileIds.length === 0) {
      return jsonResponse({ success: true, data: groupByExam ? { exams: [] } : [] });
    }

    if (selectedStudentId && !linked.profileIds.includes(selectedStudentId)) {
      return NextResponse.json(
        { error: "Requested child is not linked to this parent account" },
        { status: 403 }
      );
    }

    const scopedProfileIds = selectedStudentId ? [selectedStudentId] : linked.profileIds;
    const scopedStudentRowIds = scopedProfileIds
      .map((profileId) => linked.studentRowIdByProfileId?.get(profileId))
      .filter(Boolean) as string[];

    if (scopedStudentRowIds.length === 0) {
      return jsonResponse({ success: true, data: groupByExam ? { exams: [] } : [] });
    }

    // v2: certificate subjects use name/code/performance for StatementOfResults.
    const cacheKey = `parent:v2:${schoolId}:${userId}:${selectedStudentId || "all"}:${groupByExam ? "cert" : "flat"}`;
    const data = await withPublishedResultsCache(cacheKey, () =>
      (groupByExam
        ? loadCertificateResults({ schoolId, scopedStudentRowIds, scopedProfileIds })
        : loadPublishedParentResults({ schoolId, scopedStudentRowIds })) as any
    );

    return jsonResponse({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent results") },
      { status: 500 }
    );
  }
}

async function loadCertificateResults(input: {
  schoolId: string | null;
  scopedStudentRowIds: string[];
  scopedProfileIds: string[];
}) {
  const { data: resultRows, error: resultError } = await supabaseAdmin
    .from("results")
    .select("id, student_id, assignment_id, exam_id, score, grade, remarks, created_at, published_at, published_by")
    .eq("school_id", input.schoolId)
    .in("student_id", input.scopedStudentRowIds)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (resultError) throw resultError;
  if (!resultRows || resultRows.length === 0) return { exams: [] };

  const assignmentIds = Array.from(new Set(resultRows.map((r: any) => r.assignment_id).filter(Boolean)));

  const assignmentsById = await getAssignmentsByIds(input.schoolId, assignmentIds);
  const studentsById = await getStudentsWithProfiles(input.schoolId, input.scopedStudentRowIds);
  const subjectsById = await getAllSubjects(input.schoolId);

  const classIds = Array.from(new Set(
    Array.from(assignmentsById.values()).map((a: any) => a.class_id).filter(Boolean)
  ));

  const [classesById, schoolResult] = await Promise.all([
    getClassesById(input.schoolId, classIds),
    supabaseAdmin.from("schools").select("name").eq("id", input.schoolId).maybeSingle(),
  ]);

  const schoolName = schoolResult.data?.name || "School";

  const examGroups = new Map<string, {
    studentId: string;
    studentProfileId: string;
    examTitle: string;
    subjects: Map<string, { subjectName: string; subjectCode: string; score: number; grade: string; totalMarks: number }>;
  }>();

  for (const row of resultRows) {
    const assignment = assignmentsById.get(row.assignment_id);
    if (!assignment) continue;

    const examTitle = assignment.title || "Exam";
    const key = `${row.student_id}:${examTitle}`;

    if (!examGroups.has(key)) {
      const student = studentsById.get(row.student_id);
      examGroups.set(key, {
        studentId: row.student_id,
        studentProfileId: student?.profile_id || row.student_id,
        examTitle,
        subjects: new Map(),
      });
    }

    const group = examGroups.get(key)!;
    const subjectId = assignment.subject_id;
    if (!subjectId) continue;

    const subject = subjectsById.get(subjectId);
    group.subjects.set(subjectId, {
      subjectName: subject?.name || "Subject",
      subjectCode: subject?.code || "",
      score: row.score == null ? 0 : Number(row.score),
      grade: row.grade || "N/A",
      totalMarks: assignment.total_marks || 100,
    });
  }

  const allStudentRowIds = Array.from(new Set(
    Array.from(examGroups.values()).map((g) => g.studentId)
  ));

  const [{ data: allStudents }, parentLinksResult] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("id, profile_id, class_id, student_number")
      .eq("school_id", input.schoolId)
      .in("id", allStudentRowIds),
    supabaseAdmin
      .from("parent_students")
      .select("parent_id, student_id")
      .in("student_id", allStudentRowIds),
  ]);

  const studentByRowId = new Map((allStudents || []).map((s: any) => [s.id, s]));
  const studentClassIds = Array.from(new Set((allStudents || []).map((s: any) => s.class_id).filter(Boolean)));
  const classesMap = await getClassesById(input.schoolId, studentClassIds);

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

  const parentLinks = parentLinksResult.data || [];

  const classStudentTotals = new Map<string, Map<string, number>>();
  for (const [key, group] of examGroups) {
    const student = studentByRowId.get(group.studentId);
    const classId = student?.class_id;
    if (!classId) continue;

    const examKey = `${classId}:${group.examTitle}`;
    if (!classStudentTotals.has(examKey)) {
      classStudentTotals.set(examKey, new Map());
    }

    let total = 0;
    for (const subj of group.subjects.values()) {
      total += subj.score;
    }
    classStudentTotals.get(examKey)!.set(group.studentId, total);
  }

  const examResults: any[] = [];

  for (const [key, group] of examGroups) {
    const student = studentByRowId.get(group.studentId);
    const classId = student?.class_id;
    const classInfo = classesMap.get(classId || "");

    const subjects = Array.from(group.subjects.values())
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName))
      // Shape expected by StatementOfResults (name/code/performance).
      .map((s) => ({
        name: s.subjectName,
        code: s.subjectCode,
        score: s.score,
        grade: s.grade,
        totalMarks: s.totalMarks,
        performance: getPerformance(s.grade),
      }));
    const totalScore = subjects.reduce((sum, s) => sum + s.score, 0);
    const totalPossible = subjects.reduce((sum, s) => sum + s.totalMarks, 0);
    const average = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;
    const overallGrade = getOverallGrade(average);

    const examKey = `${classId}:${group.examTitle}`;
    const classTotals = classStudentTotals.get(examKey) || new Map();
    const sortedTotals = Array.from(classTotals.entries()).sort((a, b) => b[1] - a[1]);
    const rank = sortedTotals.findIndex(([sid]) => sid === group.studentId) + 1;
    const classSize = sortedTotals.length;

    const positionStr = rank > 0 ? `${getOrdinal(rank)} of ${classSize}` : "-";

    const lastResult = resultRows.find((r: any) =>
      r.student_id === group.studentId &&
      assignmentsById.get(r.assignment_id)?.title === group.examTitle
    );

    const verificationCode = generateVerificationCode(group.studentId, group.examTitle, input.schoolId || "");

    const studentProfile = studentsById.get(group.studentId);

    examResults.push({
      examTitle: group.examTitle,
      studentName: buildDisplayName(studentProfile?.profile || {}),
      examNumber: student?.student_number || student?.admission_number || "-",
      className: classInfo?.name || "Class",
      schoolName,
      year: new Date().getFullYear(),
      publishedAt: lastResult?.published_at || new Date().toISOString(),
      teacherName: teacherNames.get(lastResult?.published_by || "") || "Teacher",
      subjects,
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

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function loadPublishedParentResults(input: {
  schoolId: string | null;
  scopedStudentRowIds: string[];
}) {
  const { data: resultRows, error: resultError } = await supabaseAdmin
    .from("results")
    .select("id, student_id, assignment_id, exam_id, score, grade, remarks, created_at, published_at, published_by")
    .eq("school_id", input.schoolId)
    .in("student_id", input.scopedStudentRowIds)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (resultError) throw resultError;

  const assignmentIds = Array.from(new Set((resultRows || []).map((row: any) => row.assignment_id).filter(Boolean)));
  const studentRows = await getStudentsByIds(input.schoolId, input.scopedStudentRowIds);
  const assignmentsById = await getAssignmentsByIds(input.schoolId, assignmentIds);
  const classIds = Array.from(new Set(Array.from(assignmentsById.values()).map((row: any) => row.class_id).filter(Boolean)));
  const subjectIds = Array.from(new Set(Array.from(assignmentsById.values()).map((row: any) => row.subject_id).filter(Boolean)));
  const classById = await getClassesById(input.schoolId, classIds);
  const subjectById = await getSubjectsById(input.schoolId, subjectIds);

  return (resultRows || []).map((row: any) => {
    const student = studentRows.get(row.student_id);
    const assignment = assignmentsById.get(row.assignment_id);
    return {
      id: row.id,
      studentId: student?.profile_id || row.student_id,
      studentName: buildDisplayName(student?.profile || {}),
      assignmentId: row.assignment_id,
      assignmentTitle: assignment?.title || "Result",
      className: classById.get(assignment?.class_id || "")?.name || "Class",
      subjectName: subjectById.get(assignment?.subject_id || "")?.name || "Subject",
      score: row.score == null ? null : Number(row.score),
      grade: row.grade || null,
      remarks: row.remarks || null,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    };
  });
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "noStore");
}

async function getStudentsByIds(schoolId: string | null, studentIds: string[]) {
  if (!schoolId || studentIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id")
    .eq("school_id", schoolId)
    .in("id", studentIds);

  if (error) throw error;

  const profileIds = Array.from(new Set((data || []).map((row: any) => row.profile_id).filter(Boolean)));
  const { data: profiles, error: profileError } = profileIds.length > 0
    ? await supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", profileIds)
    : { data: [], error: null };

  if (profileError) throw profileError;

  const profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  return new Map(
    (data || []).map((row: any) => [
      row.id,
      { ...row, profile: profileById.get(row.profile_id || "") || null },
    ])
  );
}

async function getStudentsWithProfiles(schoolId: string | null, studentIds: string[]) {
  if (!schoolId || studentIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, student_number")
    .eq("school_id", schoolId)
    .in("id", studentIds);

  if (error) throw error;

  const profileIds = Array.from(new Set((data || []).map((row: any) => row.profile_id).filter(Boolean)));
  const { data: profiles } = profileIds.length > 0
    ? await supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", profileIds)
    : { data: [] };

  const profileById = new Map((profiles || []).map((row: any) => [row.id, row]));
  return new Map(
    (data || []).map((row: any) => [
      row.id,
      { ...row, profile: profileById.get(row.profile_id || "") || null },
    ])
  );
}

async function getAllSubjects(schoolId: string | null) {
  if (!schoolId) return new Map<string, any>();
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", schoolId);
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function getAssignmentsByIds(schoolId: string | null, assignmentIds: string[]) {
  if (!schoolId || assignmentIds.length === 0) return new Map<string, any>();

  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, title, class_id, subject_id, total_marks")
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
