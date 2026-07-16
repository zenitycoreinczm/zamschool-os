"use client";

import { invalidateInboxCaches } from "@/lib/inbox/center-client";
import { fetchUnreadSummary } from "@/lib/inbox/center-client";
import { patchCachedWorkspaceUnread } from "@/lib/workspace/context-client";

export const INBOX_REFRESH_EVENT = "zamschool:inbox-refresh";

export function dispatchInboxRefresh() {
  if (typeof window === "undefined") return;
  try {
    invalidateInboxCaches();
  } catch {
    // SSR / non-browser safety
  }

  // Reconcile workspace shell unread so badges don't stick on stale counts.
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
