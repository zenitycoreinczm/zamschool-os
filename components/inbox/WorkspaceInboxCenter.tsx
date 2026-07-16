"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Loader2, MessageSquare, Send, X } from "lucide-react";
import { toast } from "sonner";

import {
  fetchInboxPreview,
  fetchUnreadSummary,
  formatRelativeTime,
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
import { cn } from "@/lib/utils";

type PanelKey = "messages" | "notifications" | null;
type DetailKind = "message" | "notification" | null;

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
  const [detailKind, setDetailKind] = useState<DetailKind>(null);
  const [activeMessage, setActiveMessage] =
    useState<InboxMessagePreview | null>(null);
  const [activeNotification, setActiveNotification] =
    useState<InboxNotificationPreview | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

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
      try {
        const summary = await fetchUnreadSummary(apiMode, { force });
        publishUnread(summary);
      } catch {
        // Keep last known counts on transient failures.
      }
    },
    [apiMode, enabled, publishUnread],
  );

  const refreshPreview = useCallback(
    async (force = false) => {
      if (!enabled) return;
      setLoadingPreview(true);
      try {
        const preview = await fetchInboxPreview(apiMode, 8, { force });
        setPreviewMessages(preview.messages);
        setPreviewNotifications(preview.notifications);
      } catch {
        setPreviewMessages([]);
        setPreviewNotifications([]);
      } finally {
        setLoadingPreview(false);
      }
    },
    [apiMode, enabled],
  );

  const refreshAll = useCallback(
    async (force = true) => {
      await Promise.all([refreshCounts(force), refreshPreview(force)]);
    },
    [refreshCounts, refreshPreview],
  );

  useEffect(() => {
    if (!enabled) return;

    // Seed from shell summary when available; otherwise fetch once.
    if (!initialUnread) {
      void refreshCounts(true);
    }

    const handleFocus = () => void refreshCounts(true);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCounts(true);
      }
    };
    const handleInboxRefresh = () => void refreshAll(true);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(INBOX_REFRESH_EVENT, handleInboxRefresh);

    // Light polling so new messages/events appear without a full reload.
    const pollId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshCounts(true);
      }
    }, 45_000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(INBOX_REFRESH_EVENT, handleInboxRefresh);
      window.clearInterval(pollId);
    };
  }, [enabled, initialUnread, refreshAll, refreshCounts]);

  useEffect(() => {
    if (initialUnread) {
      publishUnread(initialUnread);
    }
  }, [initialUnread?.messages, initialUnread?.notifications, publishUnread]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside closes the dropdown panel (not the detail modal - that has its own backdrop).
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!panel) return;
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setPanel(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [panel]);

  useEffect(() => {
    if (!panel) return;
    void refreshPreview(true);
    void refreshCounts(true);
  }, [panel, refreshPreview, refreshCounts]);

  useEffect(() => {
    if (!panel && !detailKind) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (detailKind) {
        closeDetail();
        return;
      }
      setPanel(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [panel, detailKind]);

  const openMessageDetail = (message: InboxMessagePreview) => {
    // Open immediately - don't wait on mark-read network.
    setPanel(null);
    setDetailKind("message");
    setActiveMessage(message);
    setActiveNotification(null);
    setReplyBody("");

    setPreviewMessages((prev) => prev.filter((row) => row.id !== message.id));
    setUnread((prev) => {
      const next = {
        messages: Math.max(0, prev.messages - (message.is_read ? 0 : 1)),
        notifications: prev.notifications,
      };
      onUnreadChangeAction?.(next);
      return next;
    });

    void markMessageRead(apiMode, message.id)
      .then(() => {
        dispatchInboxRefresh();
      })
      .catch(() => {
        // Detail still open; counts reconcile on next poll.
      });
  };

  const openNotificationDetail = (notification: InboxNotificationPreview) => {
    setPanel(null);
    setDetailKind("notification");
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

    void markNotificationRead(apiMode, notification.id)
      .then(() => {
        dispatchInboxRefresh();
      })
      .catch(() => {
        // Non-blocking
      });
  };

  const closeDetail = () => {
    setDetailKind(null);
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
        className={cn("flex items-center gap-2", ws.headerActions)}
      >
        <button
          type="button"
          aria-label={
            unread.messages > 0
              ? `Messages, ${formatUnreadBadgeCount(unread.messages)} unread`
              : "Messages"
          }
          aria-expanded={panel === "messages"}
          aria-controls={panel === "messages" ? panelId : undefined}
          onClick={() => togglePanel("messages")}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-slate-500 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:h-10 md:w-10",
            panel === "messages"
              ? "border-sky-300 text-sky-700 ring-2 ring-sky-100"
              : "border-slate-200",
          )}
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
          aria-label={
            unread.notifications > 0
              ? `Notifications, ${formatUnreadBadgeCount(unread.notifications)} unread`
              : "Notifications"
          }
          aria-expanded={panel === "notifications"}
          aria-controls={panel === "notifications" ? panelId : undefined}
          onClick={() => togglePanel("notifications")}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-slate-500 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 md:h-10 md:w-10",
            panel === "notifications"
              ? "border-sky-300 text-sky-700 ring-2 ring-sky-100"
              : "border-slate-200",
          )}
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
            aria-label={
              panel === "messages" ? "Messages inbox" : "Notifications"
            }
            className={cn(
              "absolute right-0 top-12 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70",
              ws.popover,
            )}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {panel === "messages" ? "Messages" : "Notifications"}
                </h3>
                <p className="text-xs text-slate-500">
                  {panel === "messages"
                    ? `${formatUnreadBadgeCount(unread.messages)} unread`
                    : `${formatUnreadBadgeCount(unread.notifications)} unread`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPanel(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {loadingPreview ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : panel === "messages" ? (
                previewMessages.length === 0 ? (
                  <EmptyState
                    title="No unread messages"
                    hint="New messages will show up here."
                  />
                ) : (
                  previewMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => openMessageDetail(message)}
                      className="mb-0.5 flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {message.senderLabel}
                        </p>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {formatRelativeTime(message.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs font-medium text-slate-600">
                        {message.subject || "Message"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {message.body}
                      </p>
                    </button>
                  ))
                )
              ) : previewNotifications.length === 0 ? (
                <EmptyState
                  title="No unread notifications"
                  hint="Events and alerts will show up here."
                />
              ) : (
                previewNotifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotificationDetail(notification)}
                    className="mb-0.5 flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {notification.title}
                      </p>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatRelativeTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {notification.message}
                    </p>
                  </button>
                ))
              )}
            </div>

            <div className="border-t border-slate-100 p-2">
              <Link
                href={panel === "messages" ? messagesHref : notificationsHref}
                onClick={() => setPanel(null)}
                className="inline-flex w-full items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {panel === "messages"
                  ? "Open full inbox"
                  : "Open all notifications"}
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      {/* Compact centered detail - click outside (backdrop) to dismiss */}
      {detailKind ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px] transition-opacity"
            onClick={closeDetail}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-detail-title"
            className="relative z-10 flex max-h-[min(85vh,34rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {detailKind === "message" ? "Message" : "Notification"}
                </p>
                <h2
                  id="inbox-detail-title"
                  className="mt-0.5 line-clamp-2 text-base font-semibold text-slate-900"
                >
                  {detailKind === "message"
                    ? activeMessage?.subject || "Message"
                    : activeNotification?.title || "Notification"}
                </h2>
                {detailKind === "message" && activeMessage ? (
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    From {activeMessage.senderLabel}
                    {activeMessage.senderRole
                      ? ` · ${activeMessage.senderRole}`
                      : ""}
                    {activeMessage.created_at
                      ? ` · ${formatRelativeTime(activeMessage.created_at)}`
                      : ""}
                  </p>
                ) : activeNotification?.created_at ? (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatRelativeTime(activeNotification.created_at)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="shrink-0 rounded-full border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {detailKind === "message" && activeMessage ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {activeMessage.body}
                </p>
              ) : activeNotification ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {activeNotification.message}
                </p>
              ) : null}
            </div>

            {detailKind === "message" && activeMessage ? (
              <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
                <textarea
                  value={replyBody}
                  onChange={(event) => setReplyBody(event.target.value)}
                  placeholder="Write a quick reply…"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeDetail}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    disabled={sending || !replyBody.trim()}
                    onClick={() => void handleSendReply()}
                    className="ml-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-3">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
                <Link
                  href={notificationsHref}
                  onClick={closeDetail}
                  className="rounded-xl px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                >
                  Full page
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="px-3 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
