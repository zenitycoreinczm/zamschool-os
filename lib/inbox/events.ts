"use client";

import { invalidateInboxCaches } from "@/lib/inbox/center-client";

export const INBOX_REFRESH_EVENT = "zamschool:inbox-refresh";

export function dispatchInboxRefresh() {
  if (typeof window === "undefined") return;
  try {
    invalidateInboxCaches();
  } catch {
    // SSR / non-browser safety
  }
  window.dispatchEvent(new CustomEvent(INBOX_REFRESH_EVENT));
}
