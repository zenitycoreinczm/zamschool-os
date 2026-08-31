import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, buildDisplayName } from "@/lib/parent-route-utils";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const rl = await applyPlatformRateLimit({ scope: "parent-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    const { searchParams } = new URL(req.url);
    const selectedStudentId = searchParams.get("studentId");

    const parentRecord = await getParentRecord({ profileId: userId, schoolId });
    if (!parentRecord) {
      return jsonResponse({ success: true, data: [] });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: userId,
      schoolId,
      includeRowMappings: true,
    });

    if (linked.profileIds.length === 0) {
      return jsonResponse({ success: true, data: [] });
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
      return jsonResponse({ success: true, data: [] });
    }

    const { data: resultRows, error: resultError } = await supabaseAdmin
      .from("results")
      .select("id, student_id, assignment_id, score, grade, remarks, published_at, created_at")
      .eq("school_id", schoolId)
      .in("student_id", scopedStudentRowIds)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false });

    if (resultError) throw resultError;

    const assignmentIds = Array.from(new Set((resultRows || []).map((row: any) => row.assignment_id).filter(Boolean)));
    const studentRows = await getStudentsByIds(schoolId, scopedStudentRowIds);

    const assignmentsById = assignmentIds.length > 0
      ? new Map(
          (
            await supabaseAdmin
              .from("assignments")
              .select("id, title, class_id, subject_id")
              .eq("school_id", schoolId)
              .in("id", assignmentIds)
          ).data?.map((row: any) => [row.id, row]) || []
        )
      : new Map();

    const subjectIds = Array.from(new Set(Array.from(assignmentsById.values()).map((a: any) => a.subject_id).filter(Boolean)));
    const subjectById = subjectIds.length > 0
      ? new Map(
          (
            await supabaseAdmin.from("subjects").select("id, name").eq("school_id", schoolId).in("id", subjectIds)
          ).data?.map((s: any) => [s.id, s]) || []
        )
      : new Map();

    const groupedByStudent = new Map<string, any[]>();
    for (const row of resultRows || []) {
      const student = studentRows.get(row.student_id);
      const assignment = assignmentsById.get(row.assignment_id) as any;
      const subject = subjectById.get(assignment?.subject_id || "");

      const entry = {
        id: row.id,
        assignmentTitle: assignment?.title || "Result",
        subjectName: subject?.name || "Subject",
        score: row.score == null ? null : Number(row.score),
        grade: row.grade || null,
        remarks: row.remarks || null,
        publishedAt: row.published_at,
      };

      const existing = groupedByStudent.get(row.student_id) || [];
      existing.push(entry);
      groupedByStudent.set(row.student_id, existing);
    }

    const reports = Array.from(groupedByStudent.entries()).map(([studentRowId, results]) => {
      const student = studentRows.get(studentRowId);
      const scores = results.filter((r: any) => r.score != null).map((r: any) => r.score);
      const avgScore = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : null;

      return {
        studentId: student?.profile_id || studentRowId,
        studentName: buildDisplayName(student?.profile || {}),
        totalResults: results.length,
        averageScore: avgScore != null ? Math.round(avgScore * 10) / 10 : null,
        results,
      };
    });

    return jsonResponse({ success: true, data: reports });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent reports") },
      { status: 500 }
    );
  }
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "privateRead");
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
