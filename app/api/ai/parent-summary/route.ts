import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  safeErrorMessage,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  generateParentProgressSummary,
  type ParentSummaryRequest,
} from "@/lib/ai/bedrock";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
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
      key: `ai-parent-summary:${userId}:${ip}`,
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

    const parentName = profileRes.data
      ? `${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim() || "Parent"
      : "Parent";

    const { data: childrenData } = await supabaseAdmin
      .from("student_guardians")
      .select(
        "student:students!inner(id, profile_id, class_id, classes!inner(name))",
      )
      .eq("guardian_profile_id", profileId)
      .eq("school_id", schoolId);

    const studentIds = (childrenData || [])
      .map((r: any) => r.student?.profile_id || r.student?.id)
      .filter(Boolean);

    if (studentIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { summaries: {} },
      });
    }

    const children = await Promise.all(
      studentIds.map(async (studentId: string) => {
        const [resultsRes, attendanceRes] = await Promise.all([
          supabaseAdmin
            .from("results")
            .select("score")
            .eq("school_id", schoolId)
            .eq("student_id", studentId)
            .not("published_at", "is", null),
          supabaseAdmin
            .from("attendance")
            .select("status")
            .eq("school_id", schoolId)
            .eq("student_id", studentId)
            .gte(
              "date",
              new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 10),
            ),
        ]);

        const scores = (resultsRes.data || [])
          .map((r: any) => Number(r.score))
          .filter((s: number) => !Number.isNaN(s));

        const attendanceRows = attendanceRes.data || [];
        const totalDays = attendanceRows.length;
        const presentDays = attendanceRows.filter(
          (a: any) => String(a.status || "").toUpperCase() === "PRESENT",
        ).length;

        const childProfile = await supabaseAdmin
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", studentId)
          .single();

        const childName = childProfile.data
          ? `${childProfile.data.first_name || ""} ${childProfile.data.last_name || ""}`.trim() || "Child"
          : "Child";

        const riskFlags: string[] = [];
        if (scores.length > 0) {
          const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
          if (avg < 50) riskFlags.push("Low performance");
          else if (avg < 65) riskFlags.push("Needs improvement");
        }
        if (totalDays > 0) {
          const rate = (presentDays / totalDays) * 100;
          if (rate < 75) riskFlags.push("Low attendance");
          else if (rate < 90) riskFlags.push("Inconsistent attendance");
        }

        return {
          name: childName,
          className: "",
          averageScore:
            scores.length > 0
              ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
              : null,
          attendanceRate:
            totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null,
          totalResults: scores.length,
          riskFlags,
        };
      }),
    );

    const requestData: ParentSummaryRequest = {
      parentName,
      children,
    };

    const summaries = await generateParentProgressSummary(requestData);

    return NextResponse.json({ success: true, data: { summaries } });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to generate summary") },
      { status: 500 },
    );
  }
}
