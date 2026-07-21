import { NextResponse } from "next/server";

import { loadTeacherMessagingAccess } from "@/lib/teacher-message-access";
import { buildDisplayName } from "@/lib/teacher-route-common";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    if (!access.context.schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 200), 1), 500);
    const roleFilter = normalizeRoleFilter(searchParams.get("role"));
    const accessData = await loadTeacherMessagingAccess({
      schoolId: access.context.schoolId,
      actorProfileId: access.context.profileId || access.context.userId,
    });

    if (accessData.allowedProfileIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, email, role, school_id")
      .eq("school_id", access.context.schoolId)
      .in("id", accessData.allowedProfileIds);

    if (roleFilter) {
      query = query.in("role", [roleFilter, roleFilter.toUpperCase()]);
    }

    const { data, error } = await query.order("first_name", { ascending: true }).limit(limit);

    if (error) throw error;

    return NextResponse.json({
      data: (data || []).map((row: any) => ({
        id: row.id,
        label: buildDisplayName(row),
        email: row.email || null,
        role: String(row.role || "").toLowerCase(),
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load teacher contacts") },
      { status: 500 }
    );
  }
}

function normalizeRoleFilter(value: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "student" || normalized === "students") return "student";
  if (normalized === "parent" || normalized === "parents") return "parent";
  if (normalized === "admin" || normalized === "admins") return "admin";
  if (normalized === "staff") return "teacher";
  if (normalized === "teacher" || normalized === "teachers") return "teacher";
  return null;
}
