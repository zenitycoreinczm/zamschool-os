"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageLoading } from "@/components/workspace/PageLoading";
import {
  NotificationsInboxView,
  type WorkspaceNotificationItem,
} from "@/components/workspace/NotificationsInboxView";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import { accountApiJson } from "@/lib/account-portal-api";
import { dispatchInboxRefresh } from "@/lib/inbox/events";

type NotificationRow = {
  id: string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  is_read?: boolean;
  created_at?: string;
};

function mapRow(row: NotificationRow): WorkspaceNotificationItem {
  return {
    id: row.id,
    recordId: row.id,
    title: row.title || "Notification",
    body: row.message || row.body || "",
    type: row.type || "info",
    status: row.is_read ? "read" : "unread",
    href: "",
    timestamp: row.created_at || new Date().toISOString(),
  };
}

export function AccountNotificationsPage({
  title = "Notifications",
  intro = "Alerts and updates sent to your account.",
  eyebrow = "Inbox",
  accent = "sky" as HeroAccent,
  apiBase = "/api/account/notifications",
}: {
  title?: string;
  intro?: string;
  eyebrow?: string;
  accent?: HeroAccent;
  apiBase?: string;
}) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const body = await accountApiJson<{ data?: NotificationRow[] }>(
        `${apiBase}?limit=100`
      );
      setRows(body.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => rows.map(mapRow), [rows]);

  const setItemRead = (id: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, is_read: true } : row)));
  };

  const markRead = async (item: WorkspaceNotificationItem) => {
    if (item.status === "read") return;
    const previous = rows;
    setItemRead(item.id);
    try {
      await accountApiJson(`${apiBase}?id=${encodeURIComponent(item.id)}`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      dispatchInboxRefresh();
    } catch (err: unknown) {
      setRows(previous);
      toast.error(err instanceof Error ? err.message : "Failed to update notification");
    }
  };

  const markAllRead = async () => {
    const previous = rows;
    setRows((prev) => prev.map((row) => ({ ...row, is_read: true })));
    try {
      await accountApiJson(apiBase, {
        method: "PUT",
        body: JSON.stringify({ markAll: true }),
      });
      dispatchInboxRefresh();
    } catch (err: unknown) {
      setRows(previous);
      toast.error(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  };

  const loadingAccent =
    accent === "teal" || accent === "indigo" ? accent : "sky";

  if (loading) {
    return (
      <PageLoading
        label="Loading notifications"
        accent={loadingAccent}
        mode="skeleton"
        skeletonVariant="list"
      />
    );
  }

  const heroAccent = accent === "teal" || accent === "indigo" || accent === "sky" ? accent : "sky";

  return (
    <NotificationsInboxView
      title={title}
      intro={intro}
      eyebrow={eyebrow}
      accent={heroAccent}
      loading={false}
      items={items}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
    />
  );
}