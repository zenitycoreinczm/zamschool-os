"use client";

import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { adminApiJson } from "@/lib/admin-browser-api";
import { getDisplayName } from "@/lib/profile-utils";
import { MessageDailyLimitBanner } from "@/components/messages/MessageDailyLimitBanner";
import { MessageFirstVisitHint } from "@/components/messages/MessageFirstVisitHint";
import {
  AdminMessageListRow,
  MessageCharacterCount,
  MessageComposePanel,
  MessageFilterChips,
  MessageLimitReachedNotice,
  MessageSendButton,
  MessagesEmptyState,
  MessagesInboxShell,
  MessagesPageHeader,
  MessagesPageSkeleton,
  MessagesSearchField,
  messageFieldClass,
  messageLabelClass,
  messageSurfaceClass,
} from "@/components/messages/message-ui";
import { MESSAGE_BODY_MAX } from "@/lib/messages/compose-limits";
import { dispatchInboxRefresh } from "@/lib/inbox/events";
import type { MessageSendQuota } from "@/lib/messages/quota-types";

const ADMIN_FILTER_OPTIONS = [
  { id: "all" as const, label: "All" },
  { id: "unread" as const, label: "Unread" },
  { id: "read" as const, label: "Read" },
];

type MessageRow = {
  id: string;
  sender_id: string | null;
  recipient_id: string | null;
  subject: string | null;
  body: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  recipient?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

type RecipientOption = {
  id: string;
  label: string;
  role: string;
};

export default function AppMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "unread" | "read">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({
    recipientId: "",
    subject: "",
    body: "",
  });
  const [quota, setQuota] = useState<MessageSendQuota | null>(null);
  const canSendToday = quota?.canSend ?? true;
  const bodyOverLimit = form.body.length > MESSAGE_BODY_MAX;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw new Error("No active session");

        const { data: me, error: meError } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (meError) throw meError;
        if (!me?.school_id) throw new Error("No school linked to this account");

        setSchoolId(me.school_id);
        setCurrentUserId(auth.user.id);

        const [messagesBody, profilesResult] = await Promise.all([
          adminApiJson<{ data?: MessageRow[]; quota?: MessageSendQuota }>("/api/admin/messages"),
          supabase
            .from("profiles")
            .select("id, auth_user_id, first_name, last_name, email, role")
            .eq("school_id", me.school_id)
            .order("first_name", { ascending: true }),
        ]);

        setMessages(Array.isArray(messagesBody.data) ? messagesBody.data : []);
        setQuota(messagesBody.quota ?? null);

        const currentUserId = auth.user.id;
        setRecipients(
          (profilesResult.data || [])
            .map((profile: any) => {
              const identityId = String(profile.auth_user_id || profile.id || "").trim();
              return {
                id: identityId,
                label: getDisplayName(profile),
                role: String(profile.role || "user").toLowerCase(),
              };
            })
            .filter((profile) => profile.id && profile.id !== currentUserId)
        );
      } catch (error: any) {
        toast.error(error?.message || "Failed to load messages");
        setMessages([]);
        setRecipients([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (mode === "unread" && message.is_read) return false;
      if (mode === "read" && !message.is_read) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        String(message.subject || "").toLowerCase().includes(q) ||
        String(message.body || "").toLowerCase().includes(q) ||
        getParticipantLabel(message.sender).toLowerCase().includes(q) ||
        getParticipantLabel(message.recipient).toLowerCase().includes(q)
      );
    });
  }, [messages, mode, query]);

  const unreadCount = messages.filter((message) => !message.is_read).length;

  const sendMessage = async () => {
    if (!canSendToday) {
      toast.error(
        `You have used all ${quota?.limit ?? 5} school messages for today. You can send again tomorrow.`
      );
      return;
    }

    if (!form.recipientId.trim() || !form.body.trim()) {
      toast.error("Recipient and message body are required");
      return;
    }

    if (bodyOverLimit) {
      toast.error(`Message is too long. Maximum ${MESSAGE_BODY_MAX} characters.`);
      return;
    }

    setSending(true);
    const toastId = toast.loading("Sending message...");
    try {
      const result = await adminApiJson<{ quota?: MessageSendQuota }>("/api/admin/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId: form.recipientId,
          subject: form.subject.trim() || undefined,
          body: form.body.trim(),
        }),
      });

      if (result.quota) setQuota(result.quota);
      setForm({ recipientId: "", subject: "", body: "" });
      setComposeOpen(false);
      try {
        await refreshMessages();
      } catch {
        toast.error("Message sent, but the inbox could not refresh");
      }
      toast.success("Message sent", { id: toastId });
    } catch (error: any) {
      toast.error(error?.message || "Failed to send message", { id: toastId });
      try {
        await refreshMessages();
      } catch {
        // ignore refresh failure
      }
    } finally {
      setSending(false);
    }
  };

  const refreshMessages = async () => {
    const response = await adminApiJson<{ data?: MessageRow[]; quota?: MessageSendQuota }>(
      "/api/admin/messages"
    );
    setMessages(Array.isArray(response.data) ? response.data : []);
    setQuota(response.quota ?? null);
  };

  const markAsRead = async (message: MessageRow) => {
    if (message.is_read) return;
    // Skip clearly outgoing messages. Do not require recipient_id === auth uid:
    // older rows may store profile id, which left them stuck as "new" forever.
    if (
      currentUserId &&
      message.sender_id === currentUserId &&
      message.recipient_id !== currentUserId
    ) {
      return;
    }

    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, is_read: true } : item)));
    try {
      await adminApiJson(`/api/admin/messages?id=${encodeURIComponent(message.id)}`, {
        method: "PUT",
      });
      dispatchInboxRefresh();
    } catch (error: any) {
      setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, is_read: false } : item)));
      toast.error(error?.message || "Failed to mark message as read");
    }
  };

  const deleteMessage = async (message: MessageRow) => {
    const confirmDelete = confirm("Delete this message?");
    if (!confirmDelete) return;

    try {
      await adminApiJson(`/api/admin/messages?id=${encodeURIComponent(message.id)}`, {
        method: "DELETE",
      });
      setMessages((prev) => prev.filter((item) => item.id !== message.id));
      toast.success("Message deleted");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete message");
    }
  };

  if (loading) {
    return <MessagesPageSkeleton />;
  }

  return (
    <div className="space-y-5 pb-2">
      <MessagesPageHeader
        title="Messages"
        description="Send direct messages to staff, parents, and leadership. Search and filter your school inbox."
        quota={quota}
        composeOpen={composeOpen}
        canCompose={canSendToday}
        onCompose={() => setComposeOpen((value) => !value)}
      />

      <MessageFirstVisitHint role="admin" dailyLimit={quota?.limit ?? 5} />
      <MessageDailyLimitBanner quota={quota} />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          {!canSendToday && quota ? (
            <div className="mb-3">
              <MessageLimitReachedNotice quota={quota} />
            </div>
          ) : null}

          {composeOpen && canSendToday ? (
            <MessageComposePanel
              title="Compose"
              onCancel={() => {
                setComposeOpen(false);
                setForm({ recipientId: "", subject: "", body: "" });
              }}
              footer={
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <MessageSendButton
                      sending={sending}
                      disabled={
                        !form.recipientId.trim() ||
                        !form.body.trim() ||
                        bodyOverLimit ||
                        !canSendToday
                      }
                      onClick={() => void sendMessage()}
                    />
                    <p className="text-xs leading-relaxed text-slate-500">
                      Uses 1 of your {quota?.limit ?? 5} daily school messages.
                    </p>
                  </div>
                  <MessageCharacterCount value={form.body} />
                </>
              }
            >
              <label className="block">
                <span className={messageLabelClass}>Recipient</span>
                <select
                  value={form.recipientId}
                  onChange={(e) => setForm((prev) => ({ ...prev, recipientId: e.target.value }))}
                  className={messageFieldClass}
                >
                  <option value="">Select recipient</option>
                  {recipients.map((recipient) => (
                    <option key={recipient.id} value={recipient.id}>
                      {recipient.label} {recipient.role ? `(${recipient.role})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={messageLabelClass}>Subject</span>
                <input
                  value={form.subject}
                  onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Optional subject"
                  className={messageFieldClass}
                />
              </label>
              <label className="block">
                <span className={messageLabelClass}>Message</span>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={5}
                  maxLength={MESSAGE_BODY_MAX + 50}
                  placeholder="Keep it short and school-related…"
                  className={`${messageFieldClass} min-h-[140px] resize-y leading-relaxed`}
                />
              </label>
            </MessageComposePanel>
          ) : (
            <section className={`${messageSurfaceClass} p-4`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Compose</h2>
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  disabled={!canSendToday}
                  className="text-xs font-semibold text-slate-700 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open
                </button>
              </div>
              {canSendToday ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-500">
                  Send staff, parents, or students a short school-related message.
                </p>
              ) : null}
            </section>
          )}
        </div>

        <MessagesInboxShell
          title="Inbox"
          subtitle={`${filteredMessages.length} shown · ${unreadCount} unread`}
          search={<MessagesSearchField value={query} onChange={setQuery} />}
          filters={
            <MessageFilterChips
              value={mode}
              options={ADMIN_FILTER_OPTIONS}
              onChange={setMode}
            />
          }
        >
          {filteredMessages.length === 0 ? (
            <MessagesEmptyState
              title="No messages match"
              description="Try a different filter or search term."
            />
          ) : (
            <ul className={`${messageSurfaceClass} divide-y divide-slate-100 overflow-hidden`}>
              {filteredMessages.map((message) => {
                // Treat as incoming unless we know we sent it (identity-safe).
                const isOutgoing =
                  Boolean(currentUserId) &&
                  message.sender_id === currentUserId &&
                  message.recipient_id !== currentUserId;
                const isIncoming = !isOutgoing;
                return (
                  <AdminMessageListRow
                    key={message.id}
                    subject={message.subject || "No subject"}
                    routeLabel={`${getParticipantLabel(message.sender)} → ${getParticipantLabel(message.recipient)}`}
                    preview={message.body || ""}
                    isUnread={!message.is_read && isIncoming}
                    isIncoming={isIncoming}
                    onOpen={
                      !message.is_read && isIncoming
                        ? () => void markAsRead(message)
                        : undefined
                    }
                    onMarkRead={() => {
                      if (!message.is_read && isIncoming) {
                        void markAsRead(message);
                      }
                    }}
                    onDelete={() => void deleteMessage(message)}
                  />
                );
              })}
            </ul>
          )}
        </MessagesInboxShell>
      </div>
    </div>
  );
}

function getParticipantLabel(
  profile:
    | {
        first_name?: string | null;
        last_name?: string | null;
        email?: string | null;
        role?: string | null;
      }
    | null
    | undefined
) {
  if (!profile) return "-";
  return getDisplayName(profile) || profile.email || "-";
}
