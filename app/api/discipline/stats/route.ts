import { NextResponse } from "next/server";

import { requireAdminContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [
      totalResult,
      openResult,
      recentResult,
      severityResult,
      statusResult,
      topStudentsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("discipline_records")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("discipline_records")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .in("status", ["open", "investigating", "escalated"]),
      supabaseAdmin
        .from("discipline_records")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId)
        .gte("incident_date", sevenDaysAgo),
      supabaseAdmin
        .from("discipline_records")
        .select("severity")
        .eq("school_id", schoolId)
        .gte("incident_date", thirtyDaysAgo),
      supabaseAdmin
        .from("discipline_records")
        .select("status")
        .eq("school_id", schoolId)
        .gte("incident_date", thirtyDaysAgo),
      supabaseAdmin
        .from("discipline_records")
        .select("student_id")
        .eq("school_id", schoolId)
        .gte("incident_date", thirtyDaysAgo),
    ]);

    // Missing table / schema → empty stats instead of 500 for Guidance desk.
    const firstError =
      totalResult.error ||
      openResult.error ||
      recentResult.error ||
      severityResult.error ||
      statusResult.error ||
      topStudentsResult.error;
    if (firstError) {
      if (
        firstError.code === "42P01" ||
        /does not exist|relation/i.test(firstError.message || "")
      ) {
        const empty = NextResponse.json({
          success: true,
          data: {
            totalRecords: 0,
            openCases: 0,
            recentIncidents: 0,
            severityBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            statusBreakdown: {},
            topStudents: [],
          },
        });
        return applyEdgeCacheHeaders(empty, "noStore");
      }
      throw firstError;
    }

    // Compute severity breakdown
    const severityBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of severityResult.data || []) {
      const s = Number(r.severity) || 1;
      if (s >= 1 && s <= 5) severityBreakdown[s as keyof typeof severityBreakdown]++;
    }

    // Compute status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const r of statusResult.data || []) {
      const s = r.status || "unknown";
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    }

    // Compute top students by incident count
    const studentCounts = new Map<string, number>();
    for (const r of topStudentsResult.data || []) {
      const sid = r.student_id;
      studentCounts.set(sid, (studentCounts.get(sid) || 0) + 1);
    }
    const topStudentIds = Array.from(studentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    let topStudents: Array<{ studentId: string; count: number; name: string }> = [];
    if (topStudentIds.length > 0) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("id, profile_id")
        .in("id", topStudentIds);

      const profileIds = (students || []).map((s: any) => s.profile_id).filter(Boolean);
      const { data: profiles } = profileIds.length > 0
        ? await supabaseAdmin.from("profiles").select("id, first_name, last_name").in("id", profileIds)
        : { data: [] };

      const profilesById = new Map((profiles || []).map((p: any) => [p.id, p]));
      const studentsById = new Map((students || []).map((s: any) => [s.id, s]));

      topStudents = topStudentIds.map((sid) => {
        const student = studentsById.get(sid);
        const profile = student?.profile_id ? profilesById.get(student.profile_id) : null;
        return {
          studentId: sid,
          count: studentCounts.get(sid) || 0,
          name: profile
            ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Student"
            : "Student",
        };
      });
    }

    const response = NextResponse.json({
      success: true,
      data: {
        totalRecords: totalResult.count ?? 0,
        openCases: openResult.count ?? 0,
        recentIncidents: recentResult.count ?? 0,
        severityBreakdown,
        statusBreakdown,
        topStudents,
      },
    });

    return applyEdgeCacheHeaders(response, "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load discipline stats") },
      { status: 500 }
    );
  }
}
