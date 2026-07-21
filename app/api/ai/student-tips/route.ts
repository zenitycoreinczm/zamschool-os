import { NextResponse } from "next/server";

import { requireStudentContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  safeErrorMessage,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  generateStudentStudyTips,
  type StudentTipsRequest,
} from "@/lib/ai/bedrock";

export async function GET(req: Request) {
  try {
    const access = await requireStudentContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `ai-student-tips:${userId}:${ip}`,
      limit: 10,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const profileId = access.context.profileId || userId;

    const profileRes = await supabaseAdmin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", profileId)
      .single();

    const displayName = profileRes.data
      ? `${(profileRes.data as any).first_name || ""} ${(profileRes.data as any).last_name || ""}`.trim() || "Student"
      : "Student";

    const resultsRes = await supabaseAdmin
      .from("results")
      .select("score, assessment_name, created_at")
      .eq("school_id", schoolId)
      .eq("student_id", profileId)
      .not("published_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    const results = resultsRes.data || [];
    const scoredResults = results.filter(
      (r: any) => r.score != null,
    ) as Array<{ score: number; assessment_name: string | null }>;

    const averageScore =
      scoredResults.length > 0
        ? Math.round(
            scoredResults.reduce(
              (sum: number, r: any) => sum + Number(r.score),
              0,
            ) / scoredResults.length,
          )
        : null;

    const subjectMap = new Map<string, number[]>();
    for (const r of scoredResults) {
      const name = r.assessment_name || "Assessment";
      const scores = subjectMap.get(name) || [];
      scores.push(Number(r.score));
      subjectMap.set(name, scores);
    }

    const recentSubjects = Array.from(subjectMap.entries())
      .map(([name, scores]) => ({
        name,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .slice(0, 5);

    const attendanceRes = await supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("school_id", schoolId)
      .eq("student_id", profileId)
      .gte(
        "date",
        new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      );

    const attendanceRows = attendanceRes.data || [];
    const totalDays = attendanceRows.length;
    const presentDays = attendanceRows.filter(
      (a: any) =>
        String(a.status || "").toUpperCase() === "PRESENT",
    ).length;
    const attendanceRate =
      totalDays > 0
        ? Math.round((presentDays / totalDays) * 100)
        : null;

    const totalAssignments = results.length;
    const completedAssignments = scoredResults.length;

    const requestData: StudentTipsRequest = {
      studentName: displayName,
      averageScore,
      attendanceRate,
      totalAssignments,
      completedAssignments,
      recentSubjects,
      className: "",
    };

    const tips = await generateStudentStudyTips(requestData);

    return NextResponse.json({ success: true, data: { tips } });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to generate tips") },
      { status: 500 },
    );
  }
}
