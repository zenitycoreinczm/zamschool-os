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
// generation bumps on invalidate so late inflight responses cannot repopulate
// the cache after the user has marked items read.
let inboxCacheGeneration = 0;

const unreadSummaryInFlight = new Map<string, Promise<UnreadSummary>>();
const unreadSummaryCache = new Map<
  string,
  { expiresAt: number; data: UnreadSummary; generation: number }
>();
// Short client TTL: long caches made already-read items reappear as "new".
const UNREAD_SUMMARY_TTL_MS = 2_500;

const inboxPreviewInFlight = new Map<
  string,
  Promise<{
    messages: InboxMessagePreview[];
    notifications: InboxNotificationPreview[];
  }>
>();
const inboxPreviewCache = new Map<
  string,
  {
    expiresAt: number;
    generation: number;
    data: {
      messages: InboxMessagePreview[];
      notifications: InboxNotificationPreview[];
    };
  }
>();
const INBOX_PREVIEW_TTL_MS = 2_500;

export function invalidateUnreadSummaryCache() {
  inboxCacheGeneration += 1;
  unreadSummaryCache.clear();
  unreadSummaryInFlight.clear();
}

export function invalidateInboxPreviewCache() {
  inboxCacheGeneration += 1;
  inboxPreviewCache.clear();
  inboxPreviewInFlight.clear();
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
  const cacheKey = mode;
  if (options.force) {
    unreadSummaryCache.delete(cacheKey);
    unreadSummaryInFlight.delete(cacheKey);
  }

  const cached = unreadSummaryCache.get(cacheKey);
  if (
    cached &&
    Date.now() < cached.expiresAt &&
    cached.generation === inboxCacheGeneration
  ) {
    return cached.data;
  }

  const inflight = unreadSummaryInFlight.get(cacheKey);
  if (inflight && !options.force) return inflight;

  const generationAtStart = inboxCacheGeneration;
  const request: Promise<UnreadSummary> = (async () => {
    let data = await loadUnreadSummaryFromApi(mode);
    // Mark-as-read invalidated caches while this request was in flight.
    // Re-fetch once so we never publish pre-read counts as if they were new.
    if (generationAtStart !== inboxCacheGeneration) {
      data = await loadUnreadSummaryFromApi(mode);
    } else {
      unreadSummaryCache.set(cacheKey, {
        expiresAt: Date.now() + UNREAD_SUMMARY_TTL_MS,
        data,
        generation: inboxCacheGeneration,
      });
    }
    return data;
  })().finally(() => {
    if (unreadSummaryInFlight.get(cacheKey) === request) {
      unreadSummaryInFlight.delete(cacheKey);
    }
  });

  unreadSummaryInFlight.set(cacheKey, request);
  return request;
}

export async function fetchInboxPreview(
  mode: InboxApiMode = "account",
  limit = 8,
  options: FetchOptions = {},
): Promise<InboxPreviewData> {
  const cacheKey = `${mode}:${limit}`;
  if (options.force) {
    inboxPreviewCache.delete(cacheKey);
    inboxPreviewInFlight.delete(cacheKey);
  }

  const cached = inboxPreviewCache.get(cacheKey);
  if (
    cached &&
    Date.now() < cached.expiresAt &&
    cached.generation === inboxCacheGeneration
  ) {
    return cached.data;
  }

  const inflight = inboxPreviewInFlight.get(cacheKey);
  if (inflight && !options.force) return inflight;

  const generationAtStart = inboxCacheGeneration;
  const request: Promise<InboxPreviewData> = (async () => {
    let data = await loadInboxPreviewFromApi(mode, limit);
    if (generationAtStart !== inboxCacheGeneration) {
      data = await loadInboxPreviewFromApi(mode, limit);
    } else {
      inboxPreviewCache.set(cacheKey, {
        expiresAt: Date.now() + INBOX_PREVIEW_TTL_MS,
        generation: inboxCacheGeneration,
        data,
      });
    }
    return data;
  })().finally(() => {
    if (inboxPreviewInFlight.get(cacheKey) === request) {
      inboxPreviewInFlight.delete(cacheKey);
    }
  });

  inboxPreviewInFlight.set(cacheKey, request);
  return request;
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
