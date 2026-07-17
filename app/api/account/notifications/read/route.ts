import { NextResponse } from "next/server";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import { invalidateUnreadRelatedCaches } from "@/lib/inbox/read-cache";
import {
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "@/lib/inbox/queries";
import { expandMessagingIdentityIds } from "@/lib/messages/participants";
import { safeErrorMessage } from "@/lib/server-guards";

/**
 * POST /api/account/notifications/read
 * Body: { ids?: string[], notificationIds?: string[], id?: string, markAll?: boolean }
 *
 * Mobile clients call this path; keep it in sync with PUT /api/account/notifications.
 */
export async function POST(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const body = await req.json().catch(() => ({}));
    const identityIds = await expandMessagingIdentityIds(
      [actor.userId, actor.profileId].filter(Boolean) as string[],
      actor.schoolId,
    );

    if (body?.markAll === true) {
      const updatedCount = await markAllNotificationsReadForUser({
        userId: actor.userId,
        schoolId: actor.schoolId,
        identityIds,
      });
      await invalidateUnreadRelatedCaches(actor.userId, actor.schoolId);
      return NextResponse.json({ success: true, data: { updatedCount } });
    }

    const bulkIds = Array.from(
      new Set(
        [
          ...(Array.isArray(body?.ids) ? body.ids : []),
          ...(Array.isArray(body?.notificationIds) ? body.notificationIds : []),
          body?.id ? [body.id] : [],
        ]
          .flat()
          .map((value: unknown) => String(value || "").trim())
          .filter(Boolean),
      ),
    );

    if (bulkIds.length === 0) {
      return NextResponse.json(
        { error: "Notification id(s) required" },
        { status: 400 },
      );
    }

    let updatedCount = 0;
    for (const notificationId of bulkIds) {
      const updated = await markNotificationReadForUser({
        id: notificationId,
        userId: actor.userId,
        schoolId: actor.schoolId,
        identityIds,
      });
      if (updated) updatedCount += 1;
    }

    await invalidateUnreadRelatedCaches(actor.userId, actor.schoolId);
    return NextResponse.json({ success: true, data: { updatedCount } });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: safeErrorMessage(
          error,
          "Failed to mark account notification as read",
        ),
      },
      { status: 500 },
    );
  }
}
