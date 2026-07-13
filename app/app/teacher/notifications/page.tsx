"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatDate, cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  createdAt: string | null;
  isRead: boolean;
};

function normalizeNotificationRow(row: Record<string, unknown>): NotificationRow {
  const createdAt =
    (typeof row.createdAt === "string" && row.createdAt) ||
    (typeof row.created_at === "string" && row.created_at) ||
    null;
  const body =
    (typeof row.body === "string" && row.body) ||
    (typeof row.message === "string" && row.message) ||
    null;
  return {
    id: String(row.id ?? ""),
    title: String(row.title || "Notification"),
    body,
    category:
      typeof row.category === "string"
        ? row.category
        : typeof row.type === "string"
          ? row.type
          : null,
    createdAt,
    isRead: Boolean(row.isRead ?? row.is_read),
  };
}

export default function TeacherNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    try {
      const body = await adminApiJson<{
        success: boolean;
        data: unknown[];
      }>("/api/teacher/notifications");
      setNotifications(
        Array.isArray(body.data)
          ? body.data.map((row) =>
              normalizeNotificationRow((row || {}) as Record<string, unknown>),
            )
          : [],
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load notifications";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 md:p-6">
        <section className="grid w-full max-w-lg place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-slate-500">
            Loading notifications…
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
              Alerts
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Notifications
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {unreadCount > 0
                ? `${unreadCount} unread of ${notifications.length}`
                : "All caught up!"}
            </p>
          </div>
          <button
            onClick={loadNotifications}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </section>

      {notifications.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">
            No notifications yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            You&apos;ll see updates about attendance, assignments, and school
            announcements here
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={cn(
                "rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                !notif.isRead
                  ? "border-amber-200 bg-amber-50/50"
                  : "border-slate-200",
              )}
            >
              <p
                className={cn(
                  "font-semibold",
                  notif.isRead ? "text-slate-700" : "text-slate-900",
                )}
              >
                {notif.title}
              </p>
              {notif.body ? (
                <p className="mt-0.5 text-sm text-slate-500">{notif.body}</p>
              ) : null}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>{formatDate(notif.createdAt)}</span>
                {notif.category ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                    {notif.category}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
