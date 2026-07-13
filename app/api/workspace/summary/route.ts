import { NextResponse } from "next/server";

import { requireActorContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { KNOWN_ROLES } from "@/lib/roles";
import { buildWorkspaceSummary } from "@/lib/workspace/summary";
import { EDGE_CACHE } from "@/lib/edge-cache";

const WORKSPACE_ROLES = KNOWN_ROLES.filter((role) => role !== "SUPER_ADMIN");

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: WORKSPACE_ROLES,
        requireSchool: true,
      },
      req
    );

    if (!access.ok) return access.response;

    const { schoolId, role, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const summary = await buildWorkspaceSummary({
      schoolId,
      role,
      userId,
    });

    const response = NextResponse.json({
      success: true,
      data: summary,
    });
    // Private short browser cache — reload within TTL reuses client/CDN path;
    // server still prefers Redis school metrics over Supabase.
    response.headers.set("Cache-Control", EDGE_CACHE.dashboardRead);
    response.headers.set("CDN-Cache-Control", EDGE_CACHE.dashboardRead);
    response.headers.set("Vary", "Cookie, Authorization");
    if (summary.metricsSource) {
      response.headers.set("X-Metrics-Source", summary.metricsSource);
    }
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load workspace summary") },
      { status: 500 }
    );
  }
}