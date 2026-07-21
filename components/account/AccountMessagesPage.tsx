"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PenLine } from "lucide-react";
import { toast } from "sonner";

import { MessageDailyLimitBanner } from "@/components/messages/MessageDailyLimitBanner";
import { MessageFirstVisitHint } from "@/components/messages/MessageFirstVisitHint";
import {
  MessageCharacterCount,
  MessageComposePanel,
  MessageLimitReachedNotice,
  MessageSendButton,
  MessagesEmptyState,
  MessagesInboxShell,
  MessagesPageHeader,
  MessagesPageSkeleton,
  MessagesSearchField,
  MessageThreadCard,
  messageFieldClass,
  messageLabelClass,
} from "@/components/messages/message-ui";
import { MESSAGE_BODY_MAX } from "@/lib/messages/compose-limits";
import { accountApiJson } from "@/lib/account-portal-api";
import { VoiceInput } from "@/components/VoiceInput";
import { dispatchInboxRefresh } from "@/lib/inbox/events";
import type { MessageSendQuota } from "@/lib/messages/quota-types";

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string | null;
  body: string;
  is_read: boolean;
  created_at: string;
  isFromMe?: boolean;
  sender?: { label?: string; role?: string } | null;
  recipient?: { label?: string; role?: string } | null;
  other?: { label?: string; role?: string } | null;
};

type Contact = {
  id: string;
  label: string;
  role: string;
};

export function AccountMessagesPage({
  title = "Messages",
  intro = "Send and receive messages with your school community.",
  hintRole = "parent",
}: {
  title?: string;
  intro?: string;
  hintRole?: "parent" | "student";
}) {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [quota, setQuota] = useState<MessageSendQuota | null>(null);
  const [form, setForm] = useState({ recipientId: "", subject: "", body: "" });
  const canSendToday = quota?.canSend ?? true;
  const bodyOverLimit = form.body.length > MESSAGE_BODY_MAX;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [messagesBody, contactsBody] = await Promise.all([
        accountApiJson<{ data?: MessageRow[]; quota?: MessageSendQuota }>("/api/account/messages"),
        accountApiJson<{ data?: Contact[] }>("/api/account/contacts"),
      ]);
      setMessages(Array.isArray(messagesBody.data) ? messagesBody.data : []);
      setContacts(Array.isArray(contactsBody.data) ? contactsBody.data : []);
      setQuota(messagesBody.quota ?? null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((row) => {
      const haystack = [row.subject, row.body, row.other?.label, row.other?.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [messages, query]);

  const unreadCount = messages.filter((row) => !row.isFromMe && !row.is_read).length;

  const closeCompose = () => {
    setComposeOpen(false);
    setForm({ recipientId: "", subject: "", body: "" });
  };

  const sendMessage = async () => {
    if (!canSendToday) {
      toast.error(
        `You have used all ${quota?.limit ?? 5} school messages for today. You can send again tomorrow.`
      );
      return;
    }

    if (!form.recipientId || !form.body.trim()) {
      toast.error("Choose a recipient and write a message.");
      return;
    }

    if (bodyOverLimit) {
      toast.error(`Message is too long. Maximum ${MESSAGE_BODY_MAX} characters.`);
      return;
    }

    setSending(true);
    try {
      const result = await accountApiJson<{ quota?: MessageSendQuota }>("/api/account/messages", {
        method: "POST",
        body: JSON.stringify({
          recipientId: form.recipientId,
          subject: form.subject.trim() || "Message",
          body: form.body.trim(),
        }),
      });
      if (result.quota) setQuota(result.quota);
      toast.success("Message sent");
      closeCompose();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      await load();
    } finally {
      setSending(false);
    }
  };

  const markRead = async (message: MessageRow) => {
    if (message.isFromMe || message.is_read) return;
    setMessages((prev) =>
      prev.map((item) => (item.id === message.id ? { ...item, is_read: true } : item))
    );
    try {
      await accountApiJson("/api/account/messages", {
        method: "PUT",
        body: JSON.stringify({ ids: [message.id] }),
      });
      dispatchInboxRefresh();
    } catch {
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, is_read: false } : item))
      );
    }
  };

  if (loading) {
    return <MessagesPageSkeleton />;
  }

  const inboxSubtitle = [
    `${messages.length} total`,
    unreadCount > 0 ? `${unreadCount} unread` : null,
    query.trim() ? `${filtered.length} shown` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-5 pb-2">
      <MessagesPageHeader
        title={title}
        description={intro}
        quota={quota}
        composeOpen={composeOpen}
        canCompose={canSendToday}
        onCompose={() => setComposeOpen((value) => !value)}
      />

      <MessageFirstVisitHint role={hintRole} dailyLimit={quota?.limit ?? 5} />
      <MessageDailyLimitBanner quota={quota} />

      {composeOpen && canSendToday ? (
        <MessageComposePanel title="New message" onCancel={closeCompose} footer={
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <MessageSendButton
                sending={sending}
                disabled={!form.recipientId || !form.body.trim() || bodyOverLimit}
                onClick={() => void sendMessage()}
              />
              <p className="text-xs leading-relaxed text-slate-500">
                Uses 1 of your {quota?.limit ?? 5} daily school messages.
              </p>
            </div>
            <MessageCharacterCount value={form.body} />
          </>
        }>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={messageLabelClass}>Recipient</span>
              <select
                value={form.recipientId}
                onChange={(e) => setForm((prev) => ({ ...prev, recipientId: e.target.value }))}
                className={messageFieldClass}
              >
                <option value="">Select recipient</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.label} ({contact.role})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={messageLabelClass}>Subject</span>
              <input
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="e.g. Need help with homework"
                className={messageFieldClass}
              />
            </label>
          </div>
          <label className="block">
            <span className={messageLabelClass}>Message</span>
            <div className="relative">
              <textarea
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Keep it short and school-related…"
                rows={5}
                maxLength={MESSAGE_BODY_MAX + 50}
                className={`${messageFieldClass} min-h-[140px] resize-y leading-relaxed pr-10`}
              />
              <div className="absolute bottom-2 right-2">
                <VoiceInput
                  onTranscript={(text) => setForm((prev) => ({ ...prev, body: prev.body + text }))}
                />
              </div>
            </div>
          </label>
        </MessageComposePanel>
      ) : null}

      {composeOpen && !canSendToday && quota ? <MessageLimitReachedNotice quota={quota} /> : null}

      <MessagesInboxShell
        subtitle={inboxSubtitle}
        search={<MessagesSearchField value={query} onChange={setQuery} />}
      >
        {filtered.length === 0 ? (
          <MessagesEmptyState
            title={query.trim() ? "No matches" : "No messages yet"}
            description={
              query.trim()
                ? "Try another name, subject, or keyword."
                : "When you are ready, start a short school-related conversation."
            }
            action={
              !query.trim() && canSendToday ? (
                <button
                  type="button"
                  onClick={() => setComposeOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  <PenLine className="h-4 w-4" />
                  Write a message
                </button>
              ) : undefined
            }
          />
        ) : (
          filtered.map((message, index) => (
            <div
              key={message.id}
              className="animate-enter-up"
              style={{ animationDelay: `${Math.min(index * 0.04, 0.2)}s` }}
            >
              <MessageThreadCard
                subject={message.subject || "Message"}
                body={message.body}
                participantLabel={
                  message.other?.label ||
                  (message.isFromMe ? message.recipient?.label : message.sender?.label) ||
                  "Unknown contact"
                }
                participantRole={message.other?.role}
                direction={message.isFromMe ? "sent" : "received"}
                timestamp={message.created_at}
                isUnread={!message.is_read}
                onOpen={
                  !message.isFromMe && !message.is_read
                    ? () => void markRead(message)
                    : undefined
                }
                onMarkRead={
                  !message.isFromMe && !message.is_read
                    ? () => void markRead(message)
                    : undefined
                }
              />
            </div>
          ))
        )}
      </MessagesInboxShell>
    </div>
  );
}