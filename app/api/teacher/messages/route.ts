import { NextResponse } from "next/server";
import { z } from "zod";

import { loadTeacherMessagingAccess } from "@/lib/teacher-message-access";
import { requireTeacherContext } from "@/lib/server-auth";
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
  serializeTeacherInboxMessages,
} from "@/lib/messages/participants";
import { invalidateUnreadRelatedCaches } from "@/lib/inbox/read-cache";
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
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    const { schoolId } = access.context;
    const rate = await applyPlatformRateLimit({
      scope: "teacher-messages-read",
      schoolId: schoolId ?? "",
      req,
      userId: access.context.userId,
      preset: "messagesRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 50), 1), 100);
    const accessData = await loadTeacherMessagingAccess({
      schoolId: access.context.schoolId || "",
      actorProfileId: access.context.userId,
    });

    return NextResponse.json({
      data: await loadMessagesForTeacher(
        access.context.userId,
        access.context.schoolId || "",
        limit,
        accessData.allowedProfileIds
      ),
      quota: await getMessageSendQuota(access.context.userId),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch teacher messages") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;
    if (!access.context.schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const { schoolId } = access.context;
    const rate = await applyPlatformRateLimit({
      scope: "teacher-messages-write",
      schoolId: schoolId ?? "",
      req,
      userId: access.context.userId,
      preset: "messagesWrite",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const dailyLimit = await enforceDailyMessageSendLimit(access.context.userId);
    if (dailyLimit) return dailyLimit;

    const payload = createMessageSchema.parse(await req.json());
    const accessData = await loadTeacherMessagingAccess({
      schoolId: access.context.schoolId,
      actorProfileId: access.context.userId,
    });
    const recipient = await loadRecipientByIdentity(access.context.schoolId, payload.recipientId);
    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const allowedIdentities = await expandMessagingIdentityIds(
      accessData.allowedProfileIds,
      access.context.schoolId
    );
    const recipientIdentityId = resolveMessagingIdentityId(recipient);
    if (!allowedIdentities.includes(recipientIdentityId)) {
      return NextResponse.json({ error: "Recipient not authorized for this teacher" }, { status: 403 });
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("messages")
      .insert({
        sender_id: access.context.userId,
        recipient_id: recipientIdentityId,
        subject: payload.subject,
        body: payload.body,
        is_read: false,
        school_id: access.context.schoolId,
      })
      .select("id, sender_id, recipient_id, body, subject, created_at, is_read")
      .single();

    if (error) throw error;

    const insertedProfiles = await loadProfilesByIdentityIds(
      [inserted.sender_id, inserted.recipient_id, recipient.id, recipient.auth_user_id].filter(
        Boolean
      ) as string[],
      access.context.schoolId
    );

    return NextResponse.json({
      data: serializeTeacherInboxMessages([inserted], access.context.userId, insertedProfiles)[0],
      quota: await getMessageSendQuota(access.context.userId),
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to send teacher message") },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const payload = markMessagesReadSchema.parse(await req.json().catch(() => ({})));
    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }
    const updatedCount = await markMessagesAsRead(access.context.userId, schoolId, payload);
    await invalidateUnreadRelatedCaches(access.context.userId, schoolId);

    return NextResponse.json({
      success: true,
      data: { updatedCount },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }

    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update teacher messages") },
      { status: 500 }
    );
  }
}

async function loadMessagesForTeacher(
  userId: string,
  schoolId: string,
  limit: number,
  allowedProfileIds: string[]
) {
  const { data: rows, error } = await supabaseAdmin
    .from("messages")
    .select("id, sender_id, recipient_id, body, subject, created_at, is_read, school_id")
    .eq("school_id", schoolId)
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const allowedIdentities = await expandMessagingIdentityIds(allowedProfileIds, schoolId);
  const allowedSet = new Set(allowedIdentities);
  const filteredRows = (rows || []).filter((row: any) => {
    const otherId = row.sender_id === userId ? row.recipient_id : row.sender_id;
    return allowedSet.has(String(otherId || "").trim());
  });

  const participantIds = Array.from(
    new Set(filteredRows.flatMap((row: any) => [row.sender_id, row.recipient_id]).filter(Boolean))
  );
  const profilesByIdentity = await loadProfilesByIdentityIds(participantIds, schoolId);
  return serializeTeacherInboxMessages(filteredRows, userId, profilesByIdentity);
}

async function markMessagesAsRead(
  userId: string,
  schoolId: string,
  payload: z.infer<typeof markMessagesReadSchema>
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
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}
