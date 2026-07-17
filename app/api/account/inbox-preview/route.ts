import { NextResponse } from "next/server";

import { requireActorContext } from "@/lib/server-auth";
import { loadNotificationsForUser } from "@/lib/inbox/queries";
import {
  expandMessagingIdentityIds,
  loadProfilesByIdentityIds,
  summarizeParticipant,
} from "@/lib/messages/participants";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import { KNOWN_ROLES } from "@/lib/roles";

const INBOX_PREVIEW_ROLES = [...KNOWN_ROLES] as const;


export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...INBOX_PREVIEW_ROLES],
        requireSchool: false,
        allowMetadataRoleFallback: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 8), 1),
      20,
    );

    if (!access.context.schoolId) {
      return applyEdgeCacheHeaders(
        NextResponse.json({ data: { messages: [], notifications: [] } }),
        "noStore",
      );
    }

    // Match mark-as-read: messages/notifications may use auth uid OR profile id.
    const identityIds = await expandMessagingIdentityIds(
      [access.context.userId, access.context.profileId].filter(Boolean) as string[],
      access.context.schoolId,
    );
    const recipientIds =
      identityIds.length > 0 ? identityIds : [access.context.userId];

    const [messagesResult, notificationRows] = await Promise.all([
      supabaseAdmin
        .from("messages")
        .select(
          "id, sender_id, recipient_id, body, subject, created_at, is_read",
        )
        .eq("school_id", access.context.schoolId)
        .in("recipient_id", recipientIds)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(limit),
      loadNotificationsForUser({
        userId: access.context.userId,
        schoolId: access.context.schoolId,
        limit,
        identityIds: recipientIds,
      }),
    ]);

    if (messagesResult.error) {
      throw messagesResult.error;
    }

    const messageRows = messagesResult.data || [];
    const senderIds = Array.from(
      new Set(
        messageRows
          .map((row: { sender_id?: string | null }) => row.sender_id)
          .filter(Boolean),
      ),
    ) as string[];

    const profilesByIdentity = await loadProfilesByIdentityIds(
      senderIds,
      access.context.schoolId,
    );

    const messages = messageRows.map((row: any) => {
      const sender = summarizeParticipant(
        profilesByIdentity.get(String(row.sender_id || "")) || null,
      );
      return {
        id: row.id,
        sender_id: row.sender_id,
        recipient_id: row.recipient_id,
        subject: row.subject,
        body: row.body,
        created_at: row.created_at,
        is_read: row.is_read,
        senderLabel: sender?.label || "Unknown sender",
        senderRole: sender?.role || null,
      };
    });

    const notifications = (notificationRows || [])
      .filter((row: { is_read?: boolean }) => !row.is_read)
      .slice(0, limit)
      .map(
        (row: {
          id: string;
          title?: string;
          message?: string;
          body?: string;
          type?: string;
          created_at?: string;
        }) => ({
          id: row.id,
          title: row.title || "Notification",
          message: row.message || row.body || "",
          type: row.type || null,
          created_at: row.created_at,
        }),
      );

    return applyEdgeCacheHeaders(
      NextResponse.json({
        data: {
          messages,
          notifications,
        },
      }),
      "noStore",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load inbox preview") },
      { status: 500 },
    );
  }
}