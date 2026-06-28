export const INBOX_REFRESH_EVENT = "zamschool:inbox-refresh";

export function dispatchInboxRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(INBOX_REFRESH_EVENT));
}
