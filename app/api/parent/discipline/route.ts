import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked" }, { status: 403 });
    }

    const rl = await applyPlatformRateLimit({ scope: "parent-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    // Find linked children
    const { data: parent, error: parentError } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("school_id", schoolId)
      .eq("profile_id", userId)
      .maybeSingle();

    if (parentError) throw parentError;
    if (!parent) {
      const response = NextResponse.json({ success: true, data: [] });
      return applyEdgeCacheHeaders(response, "privateRead");
    }

    const { data: links, error: linksError } = await supabaseAdmin
      .from("parent_students")
      .select("student_id")
      .eq("parent_id", parent.id);

    if (linksError) throw linksError;

    const studentIds = (links || []).map((l: any) => l.student_id);
    if (studentIds.length === 0) {
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
        student:students(id, student_number, profile_id),
        category:discipline_categories(id, name),
        actions:discipline_actions(id, action_type, description, action_date, duration_days)
      `)
      .eq("school_id", schoolId)
      .in("student_id", studentIds)
      .order("incident_date", { ascending: false });

    if (error) throw error;

    // Enrich with student names
    const profileIds = Array.from(
      new Set((data || []).map((r: any) => r.student?.profile_id).filter(Boolean))
    );

    let profilesById: Record<string, { first_name: string | null; last_name: string | null }> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", profileIds);
      profilesById = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    }

    const enriched = (data || []).map((record: any) => ({
      ...record,
      student: record.student
        ? {
            ...record.student,
            first_name: profilesById[record.student.profile_id]?.first_name || null,
            last_name: profilesById[record.student.profile_id]?.last_name || null,
          }
        : null,
    }));

    const response = NextResponse.json({ success: true, data: enriched });
    return applyEdgeCacheHeaders(response, "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load discipline records") },
      { status: 500 }
    );
  }
}
