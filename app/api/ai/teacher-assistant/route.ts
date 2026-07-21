import { NextResponse } from "next/server";

import { requireTeacherContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  safeErrorMessage,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  generateTeacherRecommendations,
  type TeacherAssistantRequest,
} from "@/lib/ai/bedrock";

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

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `ai-teacher-assistant:${userId}:${ip}`,
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

    const [profileRes, teacherRes, statsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", profileId)
        .single(),
      supabaseAdmin
        .from("teachers")
        .select("pending_roll_calls, draft_results")
        .eq("profile_id", profileId)
        .eq("school_id", schoolId)
        .maybeSingle(),
      supabaseAdmin
        .from("teacher_dashboard_stats")
        .select("total_students, high_risk_students, medium_risk_students")
        .eq("teacher_id", profileId)
        .eq("school_id", schoolId)
        .maybeSingle(),
    ]);

    const displayName = profileRes.data
      ? `${(profileRes.data as any).first_name || ""} ${(profileRes.data as any).last_name || ""}`.trim() || "Teacher"
      : "Teacher";

    const teacherData = teacherRes.data as Record<string, unknown> | null;
    const statsData = statsRes.data as Record<string, unknown> | null;

    const pendingRollCalls = Number((teacherData as any)?.pending_roll_calls ?? 0);
    const draftResults = Number((teacherData as any)?.draft_results ?? 0);

    const requestData: TeacherAssistantRequest = {
      displayName,
      pendingRollCalls,
      draftResults,
      unreadMessages: 0,
      unreadNotifications: 0,
      upcomingEvents: 0,
      totalStudents: Number((statsData as any)?.total_students ?? 0),
      highRiskStudents: Number((statsData as any)?.high_risk_students ?? 0),
      mediumRiskStudents: Number((statsData as any)?.medium_risk_students ?? 0),
      assignedClasses: [],
      assignedSubjects: [],
    };

    const recommendations = await generateTeacherRecommendations(requestData);

    return NextResponse.json({
      success: true,
      data: { recommendations },
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to get recommendations") },
      { status: 500 },
    );
  }
}
