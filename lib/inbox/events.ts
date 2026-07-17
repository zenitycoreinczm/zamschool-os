"use client";

import {
  fetchUnreadSummary,
  invalidateInboxCaches,
} from "@/lib/inbox/center-client";
import { invalidateShell } from "@/lib/shell-client";
import { invalidateTeacherBootstrap } from "@/lib/teacher-bootstrap-client";
import { patchCachedWorkspaceUnread } from "@/lib/workspace/context-client";

export const INBOX_REFRESH_EVENT = "zamschool:inbox-refresh";

export type InboxRefreshDetail = {
  messages?: number;
  notifications?: number;
};

export function dispatchInboxRefresh(optimistic?: InboxRefreshDetail) {
  if (typeof window === "undefined") return;

  try {
    invalidateInboxCaches();
  } catch {
    // SSR / non-browser safety
  }

  // Drop teacher shell/bootstrap client caches so "Needs your attention"
  // cannot keep showing an already-read notification after mark-as-read.
  try {
    invalidateTeacherBootstrap();
  } catch {
    // ignore
  }
  try {
    invalidateShell();
  } catch {
    // ignore
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

  // Immediate optimistic signal so banners/badges can drop without waiting.
  window.dispatchEvent(
    new CustomEvent(INBOX_REFRESH_EVENT, {
      detail: optimistic || {},
    }),
  );

  // Reconcile from server so badges match DB after mark-as-read.
  void fetchUnreadSummary("account", { force: true })
    .then((summary) => {
      patchCachedWorkspaceUnread({
        messages: summary.messages,
        notifications: summary.notifications,
      });
      window.dispatchEvent(
        new CustomEvent(INBOX_REFRESH_EVENT, {
          detail: {
            messages: summary.messages,
            notifications: summary.notifications,
          } satisfies InboxRefreshDetail,
        }),
      );
    })
    .catch(() => {
      // non-blocking - optimistic event already fired
    });
}
