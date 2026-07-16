import { NextResponse } from "next/server";

import { loadSchoolAnnouncements } from "@/lib/announcements-server";
import { matchesRoleTarget } from "@/lib/role-audience-match";
import { requireActorContext } from "@/lib/server-auth";
import { KNOWN_ROLES } from "@/lib/roles";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { fetchProfileByIdentity } from "@/lib/profile-lookup";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

// Registrar is excluded from announcements - their role is strictly user
// registration (students, parents, teachers), not school communications.
const ANNOUNCEMENT_ALLOWED_ROLES = KNOWN_ROLES.filter(
  (r) => r !== "REGISTRAR",
);

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: ANNOUNCEMENT_ALLOWED_ROLES,
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) {
      return access.response;
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 30), 1),
      60,
    );

    const { data: profile, error: profileError } =
      await fetchProfileByIdentity<{
        id: string;
        school_id: string;
        role?: string | null;
      }>(supabaseAdmin as never, access.context.userId, "id, school_id, role");

    if (profileError) {
      throw profileError;
    }

    if (!profile?.id || !profile.school_id) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const schoolId = profile.school_id;
    const role = access.context.role;
    const viewerClassId =
      role === "STUDENT"
        ? String(
            (
              await supabaseAdmin
                .from("students")
                .select("class_id")
                .eq("profile_id", profile.id)
                .eq("school_id", schoolId)
                .maybeSingle()
            ).data?.class_id || "",
          ).trim() || null
        : null;
    const rows = await loadSchoolAnnouncements(schoolId, limit);

    return jsonWithPrivateCache({
      data: rows
        .filter(
          (row: {
            target_audience?: string | null;
            target_role?: string | null;
          }) =>
            matchesRoleTarget(row.target_audience || row.target_role, role, {
              viewerClassId,
            }),
        )
        .map((row: { body?: string | null; content?: string | null }) => ({
          ...row,
          body: row.body || row.content || "",
          content: row.content || row.body || "",
        })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(error, "Failed to fetch account announcements"),
      },
      { status: 500 },
    );
  }
}

function jsonWithPrivateCache(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "announcements");
}
