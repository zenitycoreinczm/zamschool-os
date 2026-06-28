import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyPlatformRateLimit,
  enforceDailyMessageSendLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import {
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { invalidateInboxHotReads } from "@/lib/inbox/read-cache";
import { requireAdminContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { auditDomainWrite } from "@/lib/audit-domain";
import {
  enrichAdminMessageRows,
  loadProfilesByIdentityIds,
  loadRecipientByIdentity,
  resolveMessagingIdentityId,
} from "@/lib/messages/participants";
import { getMessageSendQuota } from "@/lib/messages/send-quota";

const createMessageSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().optional(),
  body: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const rate = await applyPlatformRateLimit({
      scope: "admin-messages-read",
      schoolId,
      req,
      userId,
      preset: "messagesRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);
    const { searchParams } = new URL(req.url);
    const filterUserId = searchParams.get("userId");
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const asSender = searchParams.get("asSender") === "true";
    const viewAll = searchParams.get("viewAll") === "true";

    let query = supabaseAdmin
      .from("messages")
      .select(
        "id, sender_id, recipient_id, body, subject, is_read, created_at, school_id",
      )
      .eq("school_id", schoolId);

    if (filterUserId) {
      if (asSender) {
        query = query.eq("sender_id", filterUserId);
      } else {
        query = query.eq("recipient_id", filterUserId);
      }
    } else if (!viewAll) {
      // Default: only show messages for the current user (security fix)
      query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
    }

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: rows, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    const participantIds = Array.from(
      new Set(
        (rows || [])
          .flatMap(
            (row: {
              sender_id?: string | null;
              recipient_id?: string | null;
            }) => [row.sender_id, row.recipient_id],
          )
          .filter(Boolean),
      ),
    ) as string[];

    const profilesByIdentity = await loadProfilesByIdentityIds(
      participantIds,
      schoolId,
    );

    return NextResponse.json({
      success: true,
      data: enrichAdminMessageRows(rows || [], profilesByIdentity),
      quota: await getMessageSendQuota(userId),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch messages") },
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
      "messages",
      "create",
    );
    if (!feature.ok) return feature.response;
    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const rate = await applyPlatformRateLimit({
      scope: "admin-messages-write",
      schoolId,
      req,
      userId,
      preset: "messagesWrite",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const dailyLimit = await enforceDailyMessageSendLimit(userId);
    if (dailyLimit) return dailyLimit;

    const body = await parseJsonWithSchema(req, createMessageSchema);
    const recipient = await loadRecipientByIdentity(schoolId, body.recipientId);
    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 },
      );
    }

    const payload: Record<string, any> = {
      school_id: schoolId,
      sender_id: userId,
      recipient_id: resolveMessagingIdentityId(recipient),
      subject: body.subject?.trim() || null,
      body: body.body.trim(),
    };

    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId,
      action: "messages.create",
      entityType: "message",
      entityId: data.id,
      newData: {
        recipientId: data.recipient_id,
        subject: data.subject,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      data,
      quota: await getMessageSendQuota(userId),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to send message") },
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
      "messages",
      "update",
    );
    if (!feature.ok) return feature.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("messages")
      .update({ is_read: true })
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    invalidateInboxHotReads(access.context.userId, schoolId);

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "messages.mark_read",
      entityType: "message",
      entityId: id,
      newData: { isRead: true },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to mark message as read") },
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
      "messages",
      "delete",
    );
    if (!feature.ok) return feature.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Message ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("messages")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "messages.delete",
      entityType: "message",
      entityId: id,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete message") },
      { status: 500 },
    );
  }
}
