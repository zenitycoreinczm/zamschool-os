import { NextResponse } from "next/server";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { KNOWN_ROLES } from "@/lib/roles";
import { toSchoolDayHoursClientPayload } from "@/lib/school-day-hours";
import { loadSchoolDayHours } from "@/lib/school-day-hours-server";
import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";

/**
 * Read school day hours for any authenticated school member.
 * Used by web dashboards and the mobile app for morning reminders
 * and timetable bounds.
 */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...KNOWN_ROLES],
        requireSchool: true,
        allowMetadataRoleFallback: true,
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

    const hours = await loadSchoolDayHours(schoolId);
    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: toSchoolDayHoursClientPayload(hours),
      }),
      "schoolSettings",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load school hours") },
      { status: 500 },
    );
  }
}
