import { NextResponse } from "next/server";
import { z } from "zod";

import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import { invalidateInboxHotReads } from "@/lib/inbox/read-cache";
import {
  applyPlatformRateLimit,
  enforceDailyMessageSendLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import {
  expandMessagingIdentityIds,
  loadProfilesByIdentityIds,
  loadRecipientByIdentity,
  resolveMessagingIdentityId,
  serializeAccountMessages,
} from "@/lib/messages/participants";
import { getMessageSendQuota } from "@/lib/messages/send-quota";
import { supabaseAdmin } from "@/lib/supabase";

const createMessageSchema = z.object({
  recipientId: z.string().min(1),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(4_000),
});

const markMessagesReadSchema = z.object({
  ids: z.array(z.string().min(1)).optional(),
  conversationId: z.string().min(1).optional(),
  markAll: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;
    const rate = await applyPlatformRateLimit({
      scope: "account-messages-read",
      schoolId: actor.schoolId,
      req,
      userId: actor.userId,
      preset: "messagesRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 50), 1),
      100,
    );

    const response = NextResponse.json({
      data: await loadMessagesForActor(actor.userId, actor.schoolId, limit),
      quota: await getMessageSendQuota(actor.userId),
    });
    return applyEdgeCacheHeaders(response, "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch account messages") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const rate = await applyPlatformRateLimit({
      scope: "account-messages-write",
      schoolId: actor.schoolId,
      req,
      userId: actor.userId,
      preset: "messagesWrite",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const dailyLimit = await enforceDailyMessageSendLimit(actor.userId);
    if (dailyLimit) return dailyLimit;

    const payload = createMessageSchema.parse(await req.json());
    const recipient = await loadRecipientByIdentity(
      actor.schoolId,
      payload.recipientId,
    );
    if (!recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 },
      );
    }

    const recipientIdentityId = resolveMessagingIdentityId(recipient);

    const { data: inserted, error } = await supabaseAdmin
      .from("messages")
      .insert({
        school_id: actor.schoolId,
        sender_id: actor.userId,
        recipient_id: recipientIdentityId,
        subject: payload.subject,
        body: payload.body,
        is_read: false,
      })
      .select("id, sender_id, recipient_id, body, subject, created_at, is_read")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      data: serializeAccountMessages(
        [inserted],
        actor.userId,
        await loadProfilesByIdentityIds(
          [
            inserted.sender_id,
            inserted.recipient_id,
            recipient.id,
            recipient.auth_user_id,
          ].filter(Boolean) as string[],
          actor.schoolId,
        ),
      )[0],
      quota: await getMessageSendQuota(actor.userId),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to send message") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const payload = markMessagesReadSchema.parse(
      await req.json().catch(() => ({})),
    );
    const updatedCount = await markMessagesAsRead(
      actor.userId,
      actor.schoolId,
      payload,
    );
    // Always invalidate - mark may have hit expanded identity ids.
    invalidateInboxHotReads(actor.userId, actor.schoolId);

    return NextResponse.json({
      success: true,
      data: {
        updatedCount,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update account messages") },
      { status: 500 },
    );
  }
}

async function loadMessagesForActor(
  userId: string,
  schoolId: string,
  limit: number,
) {
  const actorIds = await expandMessagingIdentityIds([userId], schoolId);
  const ids = actorIds.length > 0 ? actorIds : [userId];
  const identityFilter = ids
    .flatMap((id) => [`sender_id.eq.${id}`, `recipient_id.eq.${id}`])
    .join(",");

  const { data: rows, error: messageError } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, recipient_id, body, subject, created_at, is_read")
    .eq("school_id", schoolId)
    .or(identityFilter)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (messageError) {
    throw messageError;
  }

  const participantIds = Array.from(
    new Set(
      (rows || [])
        .flatMap((row: any) => [row.sender_id, row.recipient_id])
        .filter(Boolean),
    ),
  );
  const profilesByIdentity = await loadProfilesByIdentityIds(
    participantIds,
    schoolId,
  );

  return serializeAccountMessages(rows || [], userId, profilesByIdentity, ids);
}

async function markMessagesAsRead(
  userId: string,
  schoolId: string,
  payload: z.infer<typeof markMessagesReadSchema>,
) {
  const targetIds = Array.from(new Set((payload.ids || []).filter(Boolean)));
  const actorIds = await expandMessagingIdentityIds([userId], schoolId);
  const recipientIds = actorIds.length > 0 ? actorIds : [userId];

  let query = supabaseAdmin
    .from("messages")
    .update({ is_read: true })
    .eq("school_id", schoolId)
    .in("recipient_id", recipientIds)
    .eq("is_read", false);

  if (targetIds.length > 0) {
    query = query.in("id", targetIds);
  } else if (payload.conversationId) {
    // Conversation peer may also be stored as auth or profile id.
    const peerIds = await expandMessagingIdentityIds(
      [payload.conversationId],
      schoolId,
    );
    query = query.in(
      "sender_id",
      peerIds.length > 0 ? peerIds : [payload.conversationId],
    );
  } else if (!payload.markAll) {
    return 0;
  }

  const { data, error } = await query.select("id");
  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.length : 0;
}
