import { NextResponse } from "next/server";

import { jsonWithPrivateCache } from "@/lib/teacher-route-common";
import { loadTeacherStudentIntelligence } from "@/lib/teacher-student-intelligence";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage, getClientIp, applyRateLimit } from "@/lib/server-guards";

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    if (!access.context.schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    // Apply rate limiting
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-students:${access.context.userId}:${ip}`,
      limit: 60,
      windowMs: 60_000, // 60 requests per minute
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    return jsonWithPrivateCache({
      success: true,
      data: await loadTeacherStudentIntelligence({
        schoolId: access.context.schoolId,
        // Assignments / teachers table key off profile id, not auth uid.
        actorProfileId:
          access.context.profileId || access.context.userId,
      }),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load teacher students") },
      { status: 500 }
    );
  }
}
