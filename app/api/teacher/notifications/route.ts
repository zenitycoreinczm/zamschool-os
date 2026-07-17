import { NextResponse } from "next/server";

import {
  loadNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "@/lib/inbox/queries";
import { invalidateUnreadRelatedCaches } from "@/lib/inbox/read-cache";
import { expandMessagingIdentityIds } from "@/lib/messages/participants";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";

async function teacherIdentityIds(context: {
  userId: string;
  schoolId: string;
  profileId?: string | null;
}) {
  return expandMessagingIdentityIds(
    [context.userId, context.profileId].filter(Boolean) as string[],
    context.schoolId,
  );
}

export async function GET(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const identityIds = await teacherIdentityIds({
      userId,
      schoolId,
      profileId: access.context.profileId,
    });
    const rows = await loadNotificationsForUser({
      userId,
      schoolId,
      limit,
      identityIds,
    });

    return NextResponse.json({
      data: rows.map((row: { message?: string; body?: string }) => ({
        ...row,
        message: row.message || row.body || "",
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch teacher notifications") },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const body = await req.json().catch(() => ({}));
    const identityIds = await teacherIdentityIds({
      userId,
      schoolId,
      profileId: access.context.profileId,
    });

    if (body?.markAll) {
      const updatedCount = await markAllNotificationsReadForUser({
        userId,
        schoolId,
        identityIds,
      });
      await invalidateUnreadRelatedCaches(userId, schoolId);
      return NextResponse.json({ success: true, data: { updatedCount, markAll: true } });
    }

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const updated = await markNotificationReadForUser({
      id,
      userId,
      schoolId,
      identityIds,
    });
    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await invalidateUnreadRelatedCaches(userId, schoolId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to mark teacher notification as read") },
      { status: 500 }
    );
  }
}