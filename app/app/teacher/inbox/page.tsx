"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { Surface } from "@/components/workspace/Surface";
import { formatDate, cn } from "@/lib/utils";

type MessageRow = {
  id: string;
  subject: string | null;
  preview: string | null;
  senderName: string;
  senderRole: string | null;
  createdAt: string;
  isRead: boolean;
};

export default function TeacherInboxPage() {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadMessages = useCallback(async () => {
    try {
      const body = await adminApiJson<{ success: boolean; data: MessageRow[] }>(
        "/api/teacher/messages",
      );
      setMessages(Array.isArray(body.data) ? body.data : []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load messages";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  const filtered = useMemo(() => {
    if (!searchTerm) return messages;
    const term = searchTerm.toLowerCase();
    return messages.filter(
      (m) =>
        (m.subject ?? "").toLowerCase().includes(term) ||
        (m.preview ?? "").toLowerCase().includes(term) ||
        m.senderName.toLowerCase().includes(term),
    );
  }, [messages, searchTerm]);

  const unreadCount = messages.filter((m) => !m.isRead).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 md:p-6">
        <section className="grid w-full max-w-lg place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-slate-500">
            Loading messages…
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Messages
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">Inbox</h1>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} unread of ${messages.length} messages`
                : `${messages.length} message${messages.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            type="button"
            onClick={loadMessages}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200",
              "disabled:opacity-50"
            )}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </section>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search messages…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        />
      </div>

      {filtered.length === 0 ? (
        <Surface variant="dashed" className="py-16 text-center">
          <p className="text-sm font-medium text-slate-600">
            {searchTerm ? "No messages match your search" : "No messages yet"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Messages from administrators, colleagues, and the school will appear
            here
          </p>
        </Surface>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((msg) => (
            <Surface
              key={msg.id}
              variant="default"
              className="p-4 transition hover:-translate-y-0.5 hover:shadow-md"
              as="article"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!msg.isRead && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-sky-500" />
                    )}
                    <p className="truncate font-semibold text-slate-900">
                      {msg.subject || "(no subject)"}
                    </p>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {msg.preview || "No preview"}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span>{msg.senderName}</span>
                    {msg.senderRole && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                        {msg.senderRole}
                      </span>
                    )}
                    <span>{formatDate(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
