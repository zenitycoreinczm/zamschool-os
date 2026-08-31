"use client";

import { accountApiJson } from "@/lib/account-portal-api";
import { adminApiJson } from "@/lib/admin-browser-api";
import { createCoalescedStore } from "@/lib/inbox/request-coalescer";

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

type FetchOptions = {
  force?: boolean;
};

/**
 * Teacher portal mutations must send CSRF like account/admin clients.
 * A bare fetch() was returning 403 Invalid CSRF on PUT mark-as-read.
 */
function teacherApiJson<T = unknown>(input: string, init?: RequestInit) {
  return accountApiJson<T>(input, init);
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

// Mode-keyed caches so admin/teacher/account never share stale data.
// Short client TTL: long caches made already-read items reappear as "new".
const UNREAD_SUMMARY_TTL_MS = 2_500;
const INBOX_PREVIEW_TTL_MS = 2_500;

const unreadSummaryStore = createCoalescedStore<UnreadSummary>();
const inboxPreviewStore = createCoalescedStore<InboxPreviewData>();

export function invalidateUnreadSummaryCache() {
  unreadSummaryStore.invalidate();
}

export function invalidateInboxPreviewCache() {
  inboxPreviewStore.invalidate();
}

export function invalidateInboxCaches() {
  invalidateUnreadSummaryCache();
  invalidateInboxPreviewCache();
}

type InboxPreviewData = {
  messages: InboxMessagePreview[];
  notifications: InboxNotificationPreview[];
};

function normalizeUniqueMessages(messages: InboxMessagePreview[]) {
  const seen = new Set<string>();
  return messages.filter((message) => {
    const id = String(message.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function normalizeUniqueNotifications(notifications: InboxNotificationPreview[]) {
  const seen = new Set<string>();
  return notifications.filter((notification) => {
    const id = String(notification.id || "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

async function loadUnreadSummaryFromApi(
  mode: InboxApiMode,
): Promise<UnreadSummary> {
  try {
    const payload = await apiJson<{
      data?: { messages?: number; notifications?: number };
    }>(mode, "/api/account/unread-summary");
    return {
      messages: Number(payload?.data?.messages || 0),
      notifications: Number(payload?.data?.notifications || 0),
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      /401|Unauthorized|Forbidden/i.test(err.message)
    ) {
      return { messages: 0, notifications: 0 };
    }
    return { messages: 0, notifications: 0 };
  }
}

async function loadInboxPreviewFromApi(
  mode: InboxApiMode,
  limit: number,
): Promise<InboxPreviewData> {
  try {
    const payload = await apiJson<{
      data?: {
        messages?: InboxMessagePreview[];
        notifications?: InboxNotificationPreview[];
      };
    }>(mode, `/api/account/inbox-preview?limit=${limit}`);
    return {
      messages: normalizeUniqueMessages(
        Array.isArray(payload?.data?.messages) ? payload.data.messages : [],
      ),
      notifications: normalizeUniqueNotifications(
        Array.isArray(payload?.data?.notifications)
          ? payload.data.notifications
          : [],
      ),
    };
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      /401|Unauthorized|Forbidden/i.test(err.message)
    ) {
      return { messages: [], notifications: [] };
    }
    return { messages: [], notifications: [] };
  }
}

export async function fetchUnreadSummary(
  mode: InboxApiMode = "account",
  options: FetchOptions = {},
): Promise<UnreadSummary> {
  return unreadSummaryStore.load(
    mode,
    () => loadUnreadSummaryFromApi(mode),
    { force: options.force, ttlMs: UNREAD_SUMMARY_TTL_MS },
  );
}

export async function fetchInboxPreview(
  mode: InboxApiMode = "account",
  limit = 8,
  options: FetchOptions = {},
): Promise<InboxPreviewData> {
  return inboxPreviewStore.load(
    `${mode}:${limit}`,
    () => loadInboxPreviewFromApi(mode, limit),
    { force: options.force, ttlMs: INBOX_PREVIEW_TTL_MS },
  );
}

export async function markMessageRead(mode: InboxApiMode, messageId: string) {
  if (mode === "admin") {
    await adminApiJson(
      `/api/admin/messages?id=${encodeURIComponent(messageId)}`,
      {
        method: "PUT",
      },
    );
  } else if (mode === "teacher") {
    await teacherApiJson("/api/teacher/messages", {
      method: "PUT",
      body: JSON.stringify({ ids: [messageId] }),
    });
  } else {
    await accountApiJson("/api/account/messages", {
      method: "PUT",
      body: JSON.stringify({ ids: [messageId] }),
    });
  }
  invalidateInboxCaches();
  // Lazy import avoids circular deps with events.ts
  const { dispatchInboxRefresh } = await import("@/lib/inbox/events");
  dispatchInboxRefresh();
}

export async function markNotificationRead(
  mode: InboxApiMode,
  notificationId: string,
) {
  // Admin and account both use the shared account notifications route.
  // Teacher has its own notifications route (same CSRF-aware client).
  if (mode === "teacher") {
    await teacherApiJson(
      `/api/teacher/notifications?id=${encodeURIComponent(notificationId)}`,
      {
        method: "PUT",
        body: JSON.stringify({}),
      },
    );
  } else {
    await accountApiJson(
      `/api/account/notifications?id=${encodeURIComponent(notificationId)}`,
      {
        method: "PUT",
        body: JSON.stringify({}),
      },
    );
  }
  invalidateInboxCaches();
  const { dispatchInboxRefresh } = await import("@/lib/inbox/events");
  dispatchInboxRefresh();
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
    invalidateInboxCaches();
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
    invalidateInboxCaches();
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
  invalidateInboxCaches();
}

export function formatUnreadBadgeCount(count: number) {
  if (!count || count < 1) {
    return "0";
  }

  return count > 99 ? "99+" : String(count);
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
