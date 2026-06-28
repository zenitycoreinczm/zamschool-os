"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";

import {
  fetchInboxPreview,
  fetchUnreadSummary,
  formatUnreadBadgeCount,
  markMessageRead,
  markNotificationRead,
  sendInboxReply,
  type InboxApiMode,
  type InboxMessagePreview,
  type InboxNotificationPreview,
} from "@/lib/inbox/center-client";
import { INBOX_REFRESH_EVENT, dispatchInboxRefresh } from "@/lib/inbox/events";
import { ws } from "@/lib/workspace/design";

type PanelKey = "messages" | "notifications" | null;
type DrawerKind = "message" | "notification" | null;

type WorkspaceInboxCenterProps = {
  apiMode?: InboxApiMode;
  messagesHref: string;
  notificationsHref: string;
  enabled?: boolean;
  initialUnread?: { messages: number; notifications: number };
  onUnreadChangeAction?: (counts: {
    messages: number;
    notifications: number;
  }) => void;
};

export function WorkspaceInboxCenter({
  apiMode = "account",
  messagesHref,
  notificationsHref,
  enabled = true,
  initialUnread,
  onUnreadChangeAction,
}: WorkspaceInboxCenterProps) {
  const [unread, setUnread] = useState({
    messages: initialUnread?.messages ?? 0,
    notifications: initialUnread?.notifications ?? 0,
  });
  const [previewMessages, setPreviewMessages] = useState<InboxMessagePreview[]>(
    [],
  );
  const [previewNotifications, setPreviewNotifications] = useState<
    InboxNotificationPreview[]
  >([]);
  const [panel, setPanel] = useState<PanelKey>(null);
  const [drawerKind, setDrawerKind] = useState<DrawerKind>(null);
  const [activeMessage, setActiveMessage] =
    useState<InboxMessagePreview | null>(null);
  const [activeNotification, setActiveNotification] =
    useState<InboxNotificationPreview | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const lastCountRefreshRef = useRef<number>(0);
  const COUNT_REFRESH_COOLDOWN_MS = 10_000;

  const publishUnread = useCallback(
    (next: { messages: number; notifications: number }) => {
      setUnread(next);
      onUnreadChangeAction?.(next);
    },
    [onUnreadChangeAction],
  );

  const refreshCounts = useCallback(
    async (force = false) => {
      if (!enabled) return;
      const now = Date.now();
      if (
        !force &&
        now - lastCountRefreshRef.current < COUNT_REFRESH_COOLDOWN_MS
      )
        return;
      lastCountRefreshRef.current = now;
      try {
        const summary = await fetchUnreadSummary(apiMode);
        publishUnread(summary);
      } catch {
        // Keep last known counts on transient failures.
      }
    },
    [apiMode, enabled, publishUnread],
  );

  const refreshPreview = useCallback(async () => {
    if (!enabled) return;
    setLoadingPreview(true);
    try {
      const preview = await fetchInboxPreview(apiMode, 8);
      setPreviewMessages(preview.messages);
      setPreviewNotifications(preview.notifications);
    } catch {
      setPreviewMessages([]);
      setPreviewNotifications([]);
    } finally {
      setLoadingPreview(false);
    }
  }, [apiMode, enabled]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCounts(), refreshPreview()]);
  }, [refreshCounts, refreshPreview]);

  useEffect(() => {
    if (!enabled) return;
    void refreshAll();

    const handleFocus = () => void refreshCounts();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCounts();
      }
    };
    const handleInboxRefresh = () => void refreshAll();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(INBOX_REFRESH_EVENT, handleInboxRefresh);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(INBOX_REFRESH_EVENT, handleInboxRefresh);
    };
  }, [enabled, refreshAll, refreshCounts]);

  useEffect(() => {
    if (initialUnread) {
      publishUnread(initialUnread);
    }
    // Track individual counts to avoid re-firing on object reference changes
  }, [initialUnread?.messages, initialUnread?.notifications, publishUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPanel(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!panel) return;
    void refreshPreview();
  }, [panel, refreshPreview]);

  // Escape + focus trap for the popup panel
  useEffect(() => {
    if (!panel || !panelRef.current) return;

    const panelEl = panelRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanel(null);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = panelEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panel]);

  // Escape + focus trap for the drawer
  useEffect(() => {
    if (!drawerKind || !drawerRef.current) return;

    const drawerEl = drawerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerKind(null);
        setActiveMessage(null);
        setActiveNotification(null);
        setReplyBody("");
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerEl.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey) {
        if (document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      const firstFocusable = drawerEl.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    });

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerKind]);

  const openMessageDrawer = async (message: InboxMessagePreview) => {
    setPanel(null);
    setDrawerKind("message");
    setActiveMessage(message);
    setActiveNotification(null);
    setReplyBody("");

    setPreviewMessages((prev) => prev.filter((row) => row.id !== message.id));
    setUnread((prev) => {
      const next = {
        messages: Math.max(0, prev.messages - 1),
        notifications: prev.notifications,
      };
      onUnreadChangeAction?.(next);
      return next;
    });

    try {
      await markMessageRead(apiMode, message.id);
      dispatchInboxRefresh();
      await refreshCounts(true);
    } catch {
      // Drawer still opens; counts reconcile on next refresh.
    }
  };

  const openNotificationDrawer = async (
    notification: InboxNotificationPreview,
  ) => {
    setPanel(null);
    setDrawerKind("notification");
    setActiveNotification(notification);
    setActiveMessage(null);

    setPreviewNotifications((prev) =>
      prev.filter((row) => row.id !== notification.id),
    );
    setUnread((prev) => {
      const next = {
        messages: prev.messages,
        notifications: Math.max(0, prev.notifications - 1),
      };
      onUnreadChangeAction?.(next);
      return next;
    });

    try {
      await markNotificationRead(apiMode, notification.id);
      dispatchInboxRefresh();
      await refreshCounts(true);
    } catch {
      // Non-blocking
    }
  };

  const closeDrawer = () => {
    setDrawerKind(null);
    setActiveMessage(null);
    setActiveNotification(null);
    setReplyBody("");
  };

  const handleSendReply = async () => {
    if (!activeMessage || !replyBody.trim()) {
      toast.error("Write a reply before sending.");
      return;
    }

    setSending(true);
    try {
      await sendInboxReply(apiMode, {
        recipientId: activeMessage.sender_id,
        subject: activeMessage.subject?.trim()
          ? `Re: ${activeMessage.subject}`
          : "Reply",
        body: replyBody.trim(),
      });
      toast.success("Reply sent");
      setReplyBody("");
      dispatchInboxRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSending(false);
    }
  };

  const togglePanel = (next: PanelKey) => {
    setPanel((current) => (current === next ? null : next));
  };

  if (!enabled) {
    return null;
  }

  const panelId = panel ? `inbox-panel-${panel}` : undefined;

  return (
    <>
      <div
        ref={rootRef}
        className={`flex items-center gap-2 ${ws.headerActions}`}
      >
        <button
          type="button"
          aria-label="Messages"
          aria-expanded={panel === "messages"}
          aria-controls={panel === "messages" ? panelId : undefined}
          onClick={() => togglePanel("messages")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:h-10 md:w-10"
        >
          <MessageSquare className="h-4 w-4" />
          {unread.messages > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {formatUnreadBadgeCount(unread.messages)}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          aria-label="Notifications"
          aria-expanded={panel === "notifications"}
          aria-controls={panel === "notifications" ? panelId : undefined}
          onClick={() => togglePanel("notifications")}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:h-10 md:w-10"
        >
          <Bell className="h-4 w-4" />
          {unread.notifications > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-[1.35rem] items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {formatUnreadBadgeCount(unread.notifications)}
            </span>
          ) : null}
        </button>

        {panel ? (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={panel === "messages" ? "Messages inbox" : "Notifications"}
            className={`absolute right-0 top-12 w-[min(92vw,22rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-workspace-lg ${ws.popover}`}
          >
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {panel === "messages" ? "Inbox" : "Alerts"}
              </p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">
                {panel === "messages"
                  ? "Unread messages"
                  : "Unread notifications"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {panel === "messages"
                  ? `${formatUnreadBadgeCount(unread.messages)} waiting`
                  : `${formatUnreadBadgeCount(unread.notifications)} waiting`}
              </p>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {loadingPreview ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : panel === "messages" ? (
                previewMessages.length === 0 ? (
                  <p className="rounded-2xl px-3 py-6 text-center text-sm text-slate-500">
                    No unread messages.
                  </p>
                ) : (
                  previewMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => void openMessageDrawer(message)}
                      className="mb-1 flex w-full flex-col rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {message.senderLabel}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-600">
                        {message.subject || "Message"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {message.body}
                      </p>
                    </button>
                  ))
                )
              ) : previewNotifications.length === 0 ? (
                <p className="rounded-2xl px-3 py-6 text-center text-sm text-slate-500">
                  No unread notifications.
                </p>
              ) : (
                previewNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void openNotificationDrawer(notification)}
                    className="mb-1 flex w-full flex-col rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    <p className="text-sm font-semibold text-slate-800">
                      {notification.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {notification.message}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-3">
              <Link
                href={panel === "messages" ? messagesHref : notificationsHref}
                onClick={() => setPanel(null)}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {panel === "messages"
                  ? "Open full inbox"
                  : "Open all notifications"}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {drawerKind ? (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <button
            type="button"
            aria-label="Close message panel"
            className="absolute inset-0 bg-slate-900/30"
            onClick={closeDrawer}
          />
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-drawer-title"
            className="relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-workspace-lg"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {drawerKind === "message"
                    ? "Quick read & reply"
                    : "Notification"}
                </p>
                <h2 id="inbox-drawer-title" className="mt-1 truncate text-lg font-semibold text-slate-900">
                  {drawerKind === "message"
                    ? activeMessage?.subject || "Message"
                    : activeNotification?.title || "Notification"}
                </h2>
                {drawerKind === "message" && activeMessage ? (
                  <p className="mt-1 text-sm text-slate-500">
                    From {activeMessage.senderLabel}
                    {activeMessage.senderRole
                      ? ` · ${activeMessage.senderRole}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {drawerKind === "message" && activeMessage ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {activeMessage.body}
                  </p>
                  <p className="mt-4 text-xs text-slate-400">
                    {activeMessage.created_at
                      ? new Date(activeMessage.created_at).toLocaleString()
                      : ""}
                  </p>
                </>
              ) : activeNotification ? (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {activeNotification.message}
                  </p>
                  {activeNotification.created_at ? (
                    <p className="mt-4 text-xs text-slate-400">
                      {new Date(activeNotification.created_at).toLocaleString()}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            {drawerKind === "message" && activeMessage ? (
              <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  Quick reply
                </label>
                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write your reply..."
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="button"
                  disabled={sending || !replyBody.trim()}
                  onClick={() => void handleSendReply()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {sending ? "Sending..." : "Send reply"}
                </button>
              </div>
            ) : (
              <div className="flex-shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
                <Link
                  href={notificationsHref}
                  onClick={closeDrawer}
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                >
                  View in notifications
                </Link>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </>
  );
}
