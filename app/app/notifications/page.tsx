"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageLoading } from "@/components/workspace/PageLoading";
import {
  NotificationsInboxView,
  type WorkspaceNotificationItem,
} from "@/components/workspace/NotificationsInboxView";
import { adminApiJson } from "@/lib/admin-browser-api";
import { dispatchInboxRefresh } from "@/lib/inbox/events";
import type { InboxItem } from "@/lib/notifications-inbox";

type InboxRecord = InboxItem & { recordId?: string };

function mapRecord(row: InboxRecord): WorkspaceNotificationItem {
  return {
    id: row.id,
    recordId: row.recordId,
    title: row.title,
    body: row.body,
    type: row.type,
    status: row.status,
    href: row.href,
    timestamp: row.timestamp,
  };
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<InboxRecord[]>([]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await adminApiJson<{ data?: InboxRecord[] }>("/api/admin/notifications");
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load notifications inbox"
      );
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inboxItems = useMemo(() => items.map(mapRecord), [items]);

  const setItemStatus = (id: string, status: InboxRecord["status"]) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  };

  const markRead = async (item: WorkspaceNotificationItem) => {
    if (item.status === "read") return;

    if (item.type !== "notification" || !item.recordId) {
      setItemStatus(item.id, "read");
      dispatchInboxRefresh();
      return;
    }

    const previous = items;
    setItemStatus(item.id, "read");
    try {
      await adminApiJson(
        `/api/admin/notifications?id=${encodeURIComponent(item.recordId)}`,
        { method: "PUT" }
      );
      dispatchInboxRefresh();
    } catch (err: unknown) {
      setItems(previous);
      toast.error(
        err instanceof Error ? err.message : "Failed to persist read state"
      );
    }
  };

  const markAllRead = async () => {
    const unread = items.filter((item) => item.status === "unread");
    if (unread.length === 0) return;

    const notifIds = unread
      .filter((item) => item.type === "notification" && item.recordId)
      .map((item) => item.recordId as string);

    if (notifIds.length === 0) {
      setItems((prev) => prev.map((item) => ({ ...item, status: "read" })));
      dispatchInboxRefresh();
      return;
    }

    const previous = items;
    setItems((prev) =>
      prev.map((item) =>
        item.type !== "notification" || !item.recordId
          ? { ...item, status: "read" }
          : notifIds.includes(item.recordId)
            ? { ...item, status: "read" }
            : item
      )
    );

    const results = await Promise.allSettled(
      notifIds.map((id) =>
        adminApiJson(`/api/admin/notifications?id=${encodeURIComponent(id)}`, {
          method: "PUT",
        }).then(() => id)
      )
    );
    const succeeded = new Set(
      results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled")
        .map((result) => result.value)
    );
    const failedCount = results.length - succeeded.size;

    setItems((prev) =>
      prev.map((item) => {
        if (item.type !== "notification" || !item.recordId) {
          return { ...item, status: "read" };
        }
        if (succeeded.has(item.recordId)) {
          return { ...item, status: "read" };
        }
        return item;
      })
    );

    if (failedCount > 0) {
      if (failedCount === results.length) {
        setItems(previous);
      }
      toast.error(
        failedCount === 1
          ? "One notification could not be marked as read"
          : `${failedCount} notifications could not be marked as read`
      );
    } else {
      dispatchInboxRefresh();
    }
  };

  if (loading) {
    return <PageLoading label="Loading notifications" accent="sky" />;
  }

  return (
    <NotificationsInboxView
      eyebrow="Workspace inbox"
      title="Notifications"
      intro="Review unread alerts, open the related workspace section, and clear your inbox. Unread counts also appear in the header bell."
      accent="sky"
      loading={false}
      items={inboxItems}
      onMarkRead={markRead}
      onMarkAllRead={markAllRead}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
    />
  );
}