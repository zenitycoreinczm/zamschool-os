import { NextResponse } from "next/server";

import { getUnreadCountsForUser } from "@/lib/inbox/read-cache";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { requireActorContext } from "@/lib/server-auth";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { safeErrorMessage } from "@/lib/server-guards";
import { KNOWN_ROLES } from "@/lib/roles";

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...KNOWN_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    // Rate-limit all callers regardless of school context.
    const rate = await applyPlatformRateLimit({
      scope: "account-unread-summary",
      schoolId: access.context.schoolId ?? "platform",
      req,
      userId: access.context.userId,
      preset: "unreadSummary",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

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
