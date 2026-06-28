import { NextResponse } from "next/server";

import { getUnreadCountsForUser } from "@/lib/inbox/read-cache";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { safeErrorMessage } from "@/lib/server-guards";

const UNREAD_SUMMARY_ROLES = [
  "ADMIN",
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "PAYMENTS",
  "DEPUTY_HEAD",
  "BURSAR",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "GUIDANCE_OFFICE",
  "SUPER_ADMIN",
] as const;

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...UNREAD_SUMMARY_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    if (access.context.schoolId) {
      const rate = await applyPlatformRateLimit({
        scope: "account-unread-summary",
        schoolId: access.context.schoolId,
        req,
        userId: access.context.userId,
        preset: "unreadSummary",
      });
      if (!rate.allowed) return platformRateLimitResponse(rate);
    }

    const counts = access.context.schoolId
      ? await getUnreadCountsForUser({
          userId: access.context.userId,
          schoolId: access.context.schoolId,
        })
      : { messages: 0, notifications: 0 };

    return applyEdgeCacheHeaders(
      NextResponse.json({
        data: {
          notifications: counts.notifications,
          messages: counts.messages,
        },
      }),
      "noStore",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load unread summary") },
      { status: 500 },
    );
  }
}
