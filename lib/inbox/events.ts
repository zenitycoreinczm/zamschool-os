"use client";

import { invalidateInboxCaches } from "@/lib/inbox/center-client";
import { fetchUnreadSummary } from "@/lib/inbox/center-client";
import { patchCachedWorkspaceUnread } from "@/lib/workspace/context-client";

export const INBOX_REFRESH_EVENT = "zamschool:inbox-refresh";

export function dispatchInboxRefresh(optimistic?: {
  messages?: number;
  notifications?: number;
}) {
  if (typeof window === "undefined") return;
  try {
    invalidateInboxCaches();
  } catch {
    // SSR / non-browser safety
  }

  // Apply optimistic counts immediately so sessionStorage/shell seed cannot
  // resurrect pre-read badges while the network refresh is in flight.
  if (
    optimistic &&
    (typeof optimistic.messages === "number" ||
      typeof optimistic.notifications === "number")
  ) {
    try {
      patchCachedWorkspaceUnread(optimistic);
    } catch {
      // ignore
    }
  }

  // Reconcile from server so badges match DB after mark-as-read.
  void fetchUnreadSummary("account", { force: true })
    .then((summary) => {
      patchCachedWorkspaceUnread({
        messages: summary.messages,
        notifications: summary.notifications,
      });
    })
    .catch(() => {
      // non-blocking
    });

  window.dispatchEvent(new CustomEvent(INBOX_REFRESH_EVENT));
}
