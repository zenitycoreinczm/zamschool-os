import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "audit", "read");
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this admin account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const rawLimit = parseInt(searchParams.get("limit") || "100", 10);
    // Clamp so the client cannot force unbounded audit_logs scans.
    const limit = Math.max(1, Math.min(Number.isFinite(rawLimit) ? rawLimit : 100, 500));

    let query = supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("school_id", schoolId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (action) {
      query = query.eq("action", action);
    }

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = data || [];
    const userIds = Array.from(
      new Set(
        rows
          .map((row) => row.user_id)
          .filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          ),
      ),
    );

    let profileById: Record<
      string,
      {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        role?: string | null;
      }
    > = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email, role")
        .eq("school_id", schoolId)
        .in("id", userIds);

      if (profilesError) throw profilesError;

      profileById = Object.fromEntries(
        (profiles || []).map((profile) => [profile.id, profile]),
      );
    }

    const enriched = rows.map((row) => ({
      ...row,
      profiles: row.user_id ? profileById[row.user_id] || null : null,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch audit logs") },
      { status: 500 },
    );
  }
}
