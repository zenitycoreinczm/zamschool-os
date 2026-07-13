import { NextResponse } from "next/server";

import { loadDashboardSummary } from "@/lib/dashboard-summary-server";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

const ALLOWED_ROLES = [
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "BURSAR",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "GUIDANCE_OFFICE",
  "SUPER_ADMIN",
  "PAYMENTS",
] as const;

/** Lightweight academic context for dashboard widgets (no role counts). */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ALLOWED_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const summary = await loadDashboardSummary(schoolId);
    const response = NextResponse.json({
      success: true,
      data: {
        schoolId: summary.schoolId,
        academicLabel: summary.academicLabel,
      },
    });
    return applyEdgeCacheHeaders(response, "dashboardRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load academic scope") },
      { status: 500 },
    );
  }
}
