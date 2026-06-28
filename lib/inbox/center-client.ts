"use client";

import { accountApiJson } from "@/lib/account-portal-api";
import { adminApiJson } from "@/lib/admin-browser-api";

export type InboxApiMode = "account" | "admin" | "teacher";

export type UnreadSummary = {
  messages: number;
  notifications: number;
};

export type InboxMessagePreview = {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  created_at: string;
  is_read: boolean;
  senderLabel: string;
  senderRole?: string | null;
};

export type InboxNotificationPreview = {
  id: string;
  title: string;
  message: string;
  type?: string | null;
  created_at?: string;
};

async function teacherApiJson<T = unknown>(
  input: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  const parsedBody = await response.json().catch(() => null);
  const body =
    typeof parsedBody === "object" && parsedBody !== null ? parsedBody : {};

  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error ||
        response.statusText ||
        `Request failed with status ${response.status}`,
    );
  }

  return body as T;
}

function apiJson<T>(mode: InboxApiMode, input: string, init?: RequestInit) {
  if (mode === "admin") {
    return adminApiJson<T>(input, init);
  }
  if (mode === "teacher") {
    return teacherApiJson<T>(input, init);
  }
  return accountApiJson<T>(input, init);
}

// In-flight promise deduplication — simultaneous calls share one request.
let unreadSummaryInFlight: Promise<UnreadSummary> | null = null;
let inboxPreviewInFlight: Promise<{
  messages: InboxMessagePreview[];
  notifications: InboxNotificationPreview[];
}> | null = null;

// TTL cache for unread summary (badge counts change infrequently)
const UNREAD_SUMMARY_TTL_MS = 30_000;
let unreadSummaryCache: { expiresAt: number; data: UnreadSummary } | null =
  null;

export function invalidateUnreadSummaryCache() {
  unreadSummaryCache = null;
  unreadSummaryInFlight = null;
}

export async function fetchUnreadSummary(
  mode: InboxApiMode = "account",
): Promise<UnreadSummary> {
  // Return cached value if fresh
  if (unreadSummaryCache && Date.now() < unreadSummaryCache.expiresAt) {
    return unreadSummaryCache.data;
  }

  // Share in-flight request
  if (unreadSummaryInFlight) return unreadSummaryInFlight;

  unreadSummaryInFlight = apiJson<{
    data?: { messages?: number; notifications?: number };
  }>(mode, "/api/account/unread-summary")
    .then((payload) => ({
      messages: Number(payload?.data?.messages || 0),
      notifications: Number(payload?.data?.notifications || 0),
    }))
    .then((data) => {
      unreadSummaryCache = {
        expiresAt: Date.now() + UNREAD_SUMMARY_TTL_MS,
        data,
      };
      return data;
    })
    .finally(() => {
      unreadSummaryInFlight = null;
    });

  return unreadSummaryInFlight;
}

// TTL cache for inbox preview (short-lived for badge data)
const INBOX_PREVIEW_TTL_MS = 30_000;
let inboxPreviewCache: {
  expiresAt: number;
  data: {
    messages: InboxMessagePreview[];
    notifications: InboxNotificationPreview[];
  };
} | null = null;

export function invalidateInboxPreviewCache() {
  inboxPreviewCache = null;
  inboxPreviewInFlight = null;
}

export async function fetchInboxPreview(
  mode: InboxApiMode = "account",
  limit = 8,
) {
  // Return cached value if fresh
  if (inboxPreviewCache && Date.now() < inboxPreviewCache.expiresAt) {
    return inboxPreviewCache.data;
  }

  // Share in-flight request
  if (inboxPreviewInFlight) return inboxPreviewInFlight;

  inboxPreviewInFlight = apiJson<{
    data?: {
      messages?: InboxMessagePreview[];
      notifications?: InboxNotificationPreview[];
    };
  }>(mode, `/api/account/inbox-preview?limit=${limit}`)
    .then((payload) => ({
      messages: Array.isArray(payload?.data?.messages)
        ? payload.data.messages
        : [],
      notifications: Array.isArray(payload?.data?.notifications)
        ? payload.data.notifications
        : [],
    }))
    .then((data) => {
      inboxPreviewCache = {
        expiresAt: Date.now() + INBOX_PREVIEW_TTL_MS,
        data,
      };
      return data;
    })
    .finally(() => {
      inboxPreviewInFlight = null;
    });

  return inboxPreviewInFlight;
}

export async function markMessageRead(mode: InboxApiMode, messageId: string) {
  if (mode === "admin") {
    await adminApiJson(
      `/api/admin/messages?id=${encodeURIComponent(messageId)}`,
      {
        method: "PUT",
      },
    );
    invalidateUnreadSummaryCache();
    invalidateInboxPreviewCache();
    return;
  }

  if (mode === "teacher") {
    await teacherApiJson("/api/teacher/messages", {
      method: "PUT",
      body: JSON.stringify({ ids: [messageId] }),
    });
    invalidateUnreadSummaryCache();
    invalidateInboxPreviewCache();
    return;
  }

  await accountApiJson("/api/account/messages", {
    method: "PUT",
    body: JSON.stringify({ ids: [messageId] }),
  });
  invalidateUnreadSummaryCache();
  invalidateInboxPreviewCache();
}

export async function markNotificationRead(
  mode: InboxApiMode,
  notificationId: string,
) {
  if (mode === "teacher") {
    await teacherApiJson(
      `/api/teacher/notifications?id=${encodeURIComponent(notificationId)}`,
      {
        method: "PUT",
      },
    );
    invalidateUnreadSummaryCache();
    invalidateInboxPreviewCache();
    return;
  }

  await accountApiJson(
    `/api/account/notifications?id=${encodeURIComponent(notificationId)}`,
    {
      method: "PUT",
    },
  );
  invalidateUnreadSummaryCache();
  invalidateInboxPreviewCache();
}

export async function sendInboxReply(
  mode: InboxApiMode,
  input: { recipientId: string; subject: string; body: string },
) {
  if (mode === "admin") {
    await adminApiJson("/api/admin/messages", {
      method: "POST",
      body: JSON.stringify({
        recipientId: input.recipientId,
        subject: input.subject,
        body: input.body,
      }),
    });
    return;
  }

  if (mode === "teacher") {
    await teacherApiJson("/api/teacher/messages", {
      method: "POST",
      body: JSON.stringify({
        recipientId: input.recipientId,
        subject: input.subject,
        body: input.body,
      }),
    });
    return;
  }

  await accountApiJson("/api/account/messages", {
    method: "POST",
    body: JSON.stringify({
      recipientId: input.recipientId,
      subject: input.subject,
      body: input.body,
    }),
  });
}

export function formatUnreadBadgeCount(count: number) {
  if (!count || count < 1) {
    return "0";
  }

  return count > 99 ? "99+" : String(count);
}
