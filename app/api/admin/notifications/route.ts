import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { tenantActorRateLimitKey } from "@/lib/tenant/tenant-context";
import { invalidateInboxHotReads } from "@/lib/inbox/read-cache";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { auditDomainWrite } from "@/lib/audit-domain";
import { matchesRoleTarget } from "@/lib/role-audience-match";

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.string().optional(),
  dedupeKey: z.string().min(1).optional(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId, userId } = access.context;
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("limit") || "100", 10)),
    );
    const offset = (page - 1) * limit;

    const [
      profileResult,
      notificationsResult,
      announcementsResult,
      eventsResult,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("notifications")
        .select(
          "id, school_id, user_id, title, message, type, is_read, created_at",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from("announcements")
        .select(
          "id, school_id, title, content, target_role, target_class_id, created_at, is_pinned",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1),
      supabaseAdmin
        .from("events")
        .select(
          "id, school_id, title, description, event_date, start_date, created_at, target_role, target_class_id",
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(limit)
        .range(offset, offset + limit - 1),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (notificationsResult.error) throw notificationsResult.error;
    if (announcementsResult.error) throw announcementsResult.error;
    if (eventsResult.error) throw eventsResult.error;

    const role = String(profileResult.data?.role || "").toLowerCase();
    const notifications = normalizeNotificationRows(
      (notificationsResult.data || []).filter((row: any) => {
        if (row.user_id && row.user_id !== userId) return false;
        if (unreadOnly && row.is_read) return false;
        return true;
      }),
    );
    const announcements = normalizeAnnouncementRows(
      (announcementsResult.data || []).filter((row: any) => {
        const targetRole = String(row.target_role || "")
          .trim()
          .toLowerCase();
        if (!targetRole || targetRole === "all") return true;
        return matchesRoleTarget(targetRole, role);
      }),
    );
    const events = normalizeEventRows(eventsResult.data || []);

    const data = [...notifications, ...announcements, ...events].sort(
      (left, right) =>
        new Date(right.timestamp).getTime() -
        new Date(left.timestamp).getTime(),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch notifications") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const feature = await requireFeatureAccess(
      access.context,
      "notifications",
      "create",
    );
    if (!feature.ok) return feature.response;
    const { schoolId, userId } = access.context;
    const rate = await applyRateLimit({
      key: tenantActorRateLimitKey({
        scope: "admin-notifications",
        schoolId,
        req,
        userId,
      }),
      limit: 80,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createNotificationSchema);

    const payload: Record<string, any> = {
      school_id: schoolId,
      user_id: body.userId,
      dedupe_key: body.dedupeKey?.trim() || null,
      title: body.title.trim(),
      message: body.message.trim(),
      type: body.type?.trim() || "info",
      is_read: false,
    };

    const notificationsQuery = supabaseAdmin.from("notifications");
    const mutation = payload.dedupe_key
      ? notificationsQuery.upsert(payload, {
          onConflict: "school_id,dedupe_key",
        })
      : notificationsQuery.insert(payload);

    const { data, error } = await mutation.select().single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId,
      action: "notifications.create",
      entityType: "notification",
      entityId: data.id,
      newData: {
        recipientId: data.user_id,
        title: data.title,
        type: data.type,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create notification") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const feature = await requireFeatureAccess(
      access.context,
      "notifications",
      "update",
    );
    if (!feature.ok) return feature.response;
    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    invalidateInboxHotReads(access.context.userId, schoolId);

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "notifications.mark_read",
      entityType: "notification",
      entityId: id,
      newData: { isRead: true },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to mark notification as read") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const feature = await requireFeatureAccess(
      access.context,
      "notifications",
      "delete",
    );
    if (!feature.ok) return feature.response;
    const { schoolId } = access.context;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Notification ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("notifications")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "notifications.delete",
      entityType: "notification",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete notification") },
      { status: 500 },
    );
  }
}

function normalizeNotificationRows(rows: any[]) {
  return rows.map((row) => ({
    id: `notification:${row.id}`,
    recordId: String(row.id),
    type: "notification",
    title: String(row.title || row.subject || "Notification"),
    body: String(row.body || row.message || row.content || ""),
    href: String(row.href || "/app/notifications"),
    status: row.is_read ? "read" : "unread",
    timestamp: String(row.created_at || new Date().toISOString()),
  }));
}

function normalizeAnnouncementRows(rows: any[]) {
  return rows.map((row) => ({
    id: `announcement:${row.id}`,
    recordId: String(row.id),
    type: "announcement",
    title: String(row.title || "Announcement"),
    body: String(row.content || ""),
    href: "/app/announcements",
    status: "read",
    timestamp: String(row.created_at || new Date().toISOString()),
  }));
}

function normalizeEventRows(rows: any[]) {
  return rows.map((row) => ({
    id: `event:${row.id}`,
    recordId: String(row.id),
    type: "event",
    title: String(row.title || "Event"),
    body: String(row.description || "Upcoming school event"),
    href: "/app/events",
    status: "read",
    timestamp: String(
      row.event_date ||
        row.start_date ||
        row.created_at ||
        new Date().toISOString(),
    ),
  }));
}
