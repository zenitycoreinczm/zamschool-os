import { NextResponse } from "next/server";

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
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const rl = await applyPlatformRateLimit({ scope: "student-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    // Find the student record for this user
    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_id", userId)
      .maybeSingle();

    if (studentError) throw studentError;
    if (!student) {
      const response = NextResponse.json({ success: true, data: [] });
      return applyEdgeCacheHeaders(response, "privateRead");
    }

    const { data, error } = await supabaseAdmin
      .from("discipline_records")
      .select(`
        id,
        title,
        description,
        incident_date,
        incident_location,
        severity,
        status,
        resolution_notes,
        resolved_at,
        created_at,
        category:discipline_categories(id, name),
        actions:discipline_actions(id, action_type, description, action_date, duration_days)
      `)
      .eq("school_id", schoolId)
      .eq("student_id", student.id)
      .order("incident_date", { ascending: false });

    if (error) throw error;

    const response = NextResponse.json({ success: true, data: data || [] });
    return applyEdgeCacheHeaders(response, "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load discipline records") },
      { status: 500 }
    );
  }
}
