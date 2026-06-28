import { NextResponse } from "next/server";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import { invalidateInboxHotReads } from "@/lib/inbox/read-cache";
import {
  loadNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "@/lib/inbox/queries";
import { safeErrorMessage } from "@/lib/server-guards";

export async function GET(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const rows = await loadNotificationsForUser({
      userId: actor.userId,
      schoolId: actor.schoolId,
      limit,
    });

    return NextResponse.json({
      data: rows.map((row: { message?: string; body?: string }) => ({
        ...row,
        message: row.message || row.body || "",
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch account notifications") },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const body = await req.json().catch(() => ({}));

    if (body?.markAll) {
      const updatedCount = await markAllNotificationsReadForUser({
        userId: actor.userId,
        schoolId: actor.schoolId,
      });
      invalidateInboxHotReads(actor.userId, actor.schoolId);
      return NextResponse.json({ success: true, data: { updatedCount } });
    }

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const updated = await markNotificationReadForUser({
      id,
      userId: actor.userId,
      schoolId: actor.schoolId,
    });
    if (!updated) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    invalidateInboxHotReads(actor.userId, actor.schoolId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to mark account notification as read") },
      { status: 500 }
    );
  }
}