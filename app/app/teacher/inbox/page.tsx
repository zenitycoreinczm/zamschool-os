"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, PenLine, RefreshCw, Reply, X } from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import {
  MessageCharacterCount,
  MessageComposePanel,
  MessageFilterChips,
  MessageLimitReachedNotice,
  MessageSendButton,
  MessageThreadCard,
  MessagesEmptyState,
  MessagesInboxShell,
  MessagesLoadingState,
  MessagesPageHeader,
  MessagesSearchField,
  messageFieldClass,
  messageLabelClass,
  messageSurfaceClass,
} from "@/components/messages/message-ui";
import { MESSAGE_BODY_MAX } from "@/lib/messages/compose-limits";
import type { MessageSendQuota } from "@/lib/messages/quota-types";
import { cn, formatDate } from "@/lib/utils";

type TeacherMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  createdAt: string;
  senderName: string;
  senderRole: string | null;
  recipientName: string;
  other?: {
    id: string;
    label: string;
    role: string | null;
    email: string | null;
  } | null;
  isFromMe: boolean;
};

type TeacherContact = {
  id: string;
  label: string;
  email: string | null;
  role: string;
};

const FILTER_OPTIONS = [
  { id: "all" as const, label: "All" },
  { id: "unread" as const, label: "Unread" },
  { id: "received" as const, label: "Received" },
  { id: "sent" as const, label: "Sent" },
];

export default function TeacherInboxPage() {
  const [messages, setMessages] = useState<TeacherMessage[]>([]);
  const [quota, setQuota] = useState<MessageSendQuota | null>(null);
  const [contacts, setContacts] = useState<TeacherContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "unread" | "received" | "sent">("all");
  const [composeOpen, setComposeOpen] = useState(false);
  const [activeMessage, setActiveMessage] = useState<TeacherMessage | null>(null);

  const [composeForm, setComposeForm] = useState({
    recipientId: "",
    subject: "",
    body: "",
  });

  const loadMessages = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await adminApiJson<{
        data?: TeacherMessage[];
        quota?: MessageSendQuota;
      }>("/api/teacher/messages");

      setMessages(Array.isArray(res.data) ? res.data : []);
      if (res.quota) setQuota(res.quota);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load messages";
      toast.error(msg);
      setMessages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    if (contacts.length > 0 || contactsLoading) return;
    setContactsLoading(true);
    try {
      const res = await adminApiJson<{ data?: TeacherContact[] }>("/api/teacher/contacts");
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err: unknown) {
      console.warn("Could not load contacts:", err);
    } finally {
      setContactsLoading(false);
    }
  }, [contacts.length, contactsLoading]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const markAsRead = async (message: TeacherMessage) => {
    if (message.isRead || message.isFromMe) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m)),
    );

    try {
      await adminApiJson("/api/teacher/messages", {
        method: "PUT",
        body: JSON.stringify({ ids: [message.id] }),
      });
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, isRead: false } : m)),
      );
    }
  };

  const handleOpenMessage = (message: TeacherMessage) => {
    setActiveMessage(message);
    if (!message.isRead && !message.isFromMe) {
      void markAsRead(message);
    }
  };

  const handleReply = (message: TeacherMessage) => {
    const recipientId = message.isFromMe ? message.recipient_id : message.sender_id;
    const cleanSubject = message.subject?.startsWith("Re: ")
      ? message.subject
      : `Re: ${message.subject || "Message"}`;

    setComposeForm({
      recipientId: recipientId || "",
      subject: cleanSubject,
      body: "",
    });
    void loadContacts();
    setComposeOpen(true);
    setActiveMessage(null);
  };

  const handleSendMessage = async () => {
    if (quota && !quota.canSend) {
      toast.error("Daily send limit reached. You can send again tomorrow.");
      return;
    }

    if (!composeForm.recipientId.trim()) {
      toast.error("Please select a recipient");
      return;
    }

    if (!composeForm.body.trim()) {
      toast.error("Please enter a message body");
      return;
    }

    setSending(true);
    const toastId = toast.loading("Sending message...");
    try {
      const res = await adminApiJson<{ data?: TeacherMessage; quota?: MessageSendQuota }>(
        "/api/teacher/messages",
        {
          method: "POST",
          body: JSON.stringify({
            recipientId: composeForm.recipientId.trim(),
            subject: composeForm.subject.trim() || "Message",
            body: composeForm.body.trim(),
          }),
        },
      );

      toast.success("Message sent successfully", { id: toastId });
      setComposeForm({ recipientId: "", subject: "", body: "" });
      setComposeOpen(false);

      if (res.quota) setQuota(res.quota);
      void loadMessages(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message";
      toast.error(errorMsg, { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      if (filterMode === "unread" && (m.isRead || m.isFromMe)) return false;
      if (filterMode === "received" && m.isFromMe) return false;
      if (filterMode === "sent" && !m.isFromMe) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        (m.subject || "").toLowerCase().includes(q) ||
        (m.body || "").toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.recipientName.toLowerCase().includes(q)
      );
    });
  }, [messages, filterMode, searchTerm]);

  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.isRead && !m.isFromMe).length;
  }, [messages]);

  const canSendToday = quota?.canSend ?? true;
  const isBodyOverLimit = composeForm.body.length > MESSAGE_BODY_MAX;
  const selectedContact = contacts.find((contact) => contact.id === composeForm.recipientId);

  // Group contacts by role for the select dropdown
  const groupedContacts = useMemo(() => {
    const groups: Record<string, TeacherContact[]> = {
      Administration: [],
      Teachers: [],
      Parents: [],
      Students: [],
    };

    contacts.forEach((c) => {
      const role = (c.role || "").toLowerCase();
      if (role.includes("admin") || role.includes("principal") || role.includes("deputy")) {
        groups.Administration.push(c);
      } else if (role.includes("teacher")) {
        groups.Teachers.push(c);
      } else if (role.includes("parent")) {
        groups.Parents.push(c);
      } else {
        groups.Students.push(c);
      }
    });

    return groups;
  }, [contacts]);

  return (
    <div className="space-y-5 pb-6">
      <MessagesPageHeader
        title="Messages"
        eyebrow="Staff desk"
        description="Direct communication with school administrators, fellow teachers, and parents."
        quota={quota}
        composeOpen={composeOpen}
        canCompose={canSendToday}
        onCompose={() => {
          setComposeOpen((prev) => {
            const next = !prev;
            if (next) void loadContacts();
            return next;
          });
        }}
        extraActions={
          <button
            type="button"
            onClick={() => void loadMessages(true)}
            disabled={refreshing}
            aria-label="Refresh messages"
            className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 p-2.5 text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,360px)_1fr]">
        {/* Left Column: Compose Panel / Status */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          {!canSendToday && quota ? (
            <MessageLimitReachedNotice quota={quota} />
          ) : null}

          {composeOpen && canSendToday ? (
            <MessageComposePanel
              title="New message"
              onCancel={() => {
                setComposeOpen(false);
                setComposeForm({ recipientId: "", subject: "", body: "" });
              }}
              footer={
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <MessageSendButton
                      sending={sending}
                      disabled={
                        !composeForm.recipientId.trim() ||
                        !composeForm.body.trim() ||
                        isBodyOverLimit ||
                        !canSendToday
                      }
                      onClick={() => void handleSendMessage()}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <MessageCharacterCount value={composeForm.body} />
                    {quota ? (
                      <span>{quota.remaining} message{quota.remaining === 1 ? "" : "s"} left today</span>
                    ) : null}
                  </div>
                </>
              }
            >
              <label className="block">
                <span className={messageLabelClass}>Recipient</span>
                <select
                  value={composeForm.recipientId}
                  onChange={(e) =>
                    setComposeForm((prev) => ({ ...prev, recipientId: e.target.value }))
                  }
                  className={messageFieldClass}
                  aria-describedby="recipient-help"
                >
                  <option value="">Select recipient...</option>
                  {Object.entries(groupedContacts).map(([groupName, items]) =>
                    items.length > 0 ? (
                      <optgroup key={groupName} label={groupName}>
                        {items.map((contact) => (
                          <option key={contact.id} value={contact.id}>
                            {contact.label} {contact.email ? `(${contact.email})` : ""}
                          </option>
                        ))}
                      </optgroup>
                    ) : null,
                  )}
                </select>
                <span id="recipient-help" className="mt-1 block text-xs text-slate-500">
                  {contactsLoading
                    ? "Loading people you can message…"
                    : selectedContact
                      ? `Sending to ${selectedContact.label}${selectedContact.role ? ` · ${selectedContact.role}` : ""}`
                      : contacts.length === 0
                        ? "No available recipients for your account yet."
                        : `${contacts.length} school contact${contacts.length === 1 ? "" : "s"} available`}
                </span>
              </label>

              <label className="block">
                <span className={messageLabelClass}>Subject</span>
                <input
                  type="text"
                  value={composeForm.subject}
                  onChange={(e) =>
                    setComposeForm((prev) => ({ ...prev, subject: e.target.value }))
                  }
                  placeholder="e.g. Homework update, Attendance question..."
                  className={messageFieldClass}
                />
              </label>

              <label className="block">
                <span className={messageLabelClass}>Message</span>
                <textarea
                  value={composeForm.body}
                  onChange={(e) =>
                    setComposeForm((prev) => ({ ...prev, body: e.target.value }))
                  }
                  rows={5}
                  maxLength={MESSAGE_BODY_MAX + 50}
                  placeholder="Write your message here..."
                  className={cn(messageFieldClass, "min-h-[140px] resize-y leading-relaxed")}
                />
              </label>
            </MessageComposePanel>
          ) : (
            <section className={cn(messageSurfaceClass, "p-5")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <Mail className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">Compose message</h2>
                </div>
                {canSendToday && (
                  <button
                    type="button"
                    onClick={() => {
                      setComposeOpen(true);
                      void loadContacts();
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <PenLine className="h-3 w-3" />
                    New
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Reach out directly to school administrators, subject colleagues, or parents of students in your classes.
              </p>
            </section>
          )}
        </div>

        {/* Right Column: Inbox / Message Details */}
        <div>
          {loading ? (
            <MessagesLoadingState label="Loading your messages..." />
          ) : (
            <MessagesInboxShell
              title="Inbox"
              subtitle={`${filteredMessages.length} message${filteredMessages.length !== 1 ? "s" : ""}${unreadCount > 0 ? ` · ${unreadCount} unread` : ""}`}
              search={
                <MessagesSearchField
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Search by subject, sender, or content..."
                />
              }
              filters={
                <MessageFilterChips
                  value={filterMode}
                  options={FILTER_OPTIONS}
                  onChange={setFilterMode}
                />
              }
            >
              {filteredMessages.length === 0 ? (
                <MessagesEmptyState
                  title={searchTerm || filterMode !== "all" ? "No matching messages" : "No messages yet"}
                  description={
                    searchTerm || filterMode !== "all"
                      ? "Try clearing your search or switching to another filter."
                      : "Messages from administrators, colleagues, and parents will appear here."
                  }
                  action={
                    canSendToday && (
                      <button
                        type="button"
                        onClick={() => {
                          setComposeOpen(true);
                          void loadContacts();
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
                      >
                        <PenLine className="h-3.5 w-3.5" />
                        Send your first message
                      </button>
                    )
                  }
                />
              ) : (
                <div className="space-y-2.5">
                  {filteredMessages.map((msg) => {
                    const direction = msg.isFromMe ? "sent" : "received";
                    const participant = msg.isFromMe ? msg.recipientName : msg.senderName;
                    const role = msg.isFromMe ? null : msg.senderRole;

                    return (
                      <MessageThreadCard
                        key={msg.id}
                        subject={msg.subject || "(No subject)"}
                        body={msg.body || ""}
                        participantLabel={participant || "Unknown"}
                        participantRole={role || undefined}
                        direction={direction}
                        timestamp={msg.createdAt}
                        isUnread={!msg.isRead && !msg.isFromMe}
                        onOpen={() => handleOpenMessage(msg)}
                        onMarkRead={() => void markAsRead(msg)}
                      />
                    );
                  })}
                </div>
              )}
            </MessagesInboxShell>
          )}
        </div>
      </div>

      {/* Message Reader Modal / Viewer */}
      {activeMessage ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="message-viewer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          onClick={() => setActiveMessage(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                      activeMessage.isFromMe
                        ? "bg-slate-100 text-slate-700"
                        : "bg-slate-900 text-white",
                    )}
                  >
                    {activeMessage.isFromMe ? "Sent by you" : "Received"}
                  </span>
                  <time className="text-xs text-slate-400">
                    {formatDate(activeMessage.createdAt)}
                  </time>
                </div>
                <h2
                  id="message-viewer-title"
                  className="mt-2 text-lg font-bold text-slate-950"
                >
                  {activeMessage.subject || "(No subject)"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                aria-label="Close message"
                className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">From:</span>
                <span>{activeMessage.senderName}</span>
                {activeMessage.senderRole ? (
                  <span className="rounded bg-white px-1.5 py-0.5 font-medium text-slate-500 ring-1 ring-slate-200">
                    {activeMessage.senderRole}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">To:</span>
                <span>{activeMessage.recipientName}</span>
              </div>
            </div>

            <div className="mt-5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800">
              {activeMessage.body}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => handleReply(activeMessage)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Reply className="h-3.5 w-3.5" />
                Reply
              </button>

              <button
                type="button"
                onClick={() => setActiveMessage(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
