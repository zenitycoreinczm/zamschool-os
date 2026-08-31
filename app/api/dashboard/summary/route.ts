import { NextResponse } from "next/server";

import { loadDashboardSummary } from "@/lib/dashboard-summary-server";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;

    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const data = await loadDashboardSummary(schoolId);
    return applyEdgeCacheHeaders(
      NextResponse.json({ success: true, data }),
      "dashboardRead",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load dashboard summary") },
      { status: 500 },
    );
  }
}
