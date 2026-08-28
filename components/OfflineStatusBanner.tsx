"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RefreshCw, WifiOff } from "lucide-react";

import {
  getNetworkStatusSnapshot,
  subscribeToNetworkStatus,
} from "@/lib/network-status";
import {
  getSyncQueueCount,
  subscribeToSyncQueue,
} from "@/lib/offline-sync-queue";

export default function OfflineStatusBanner({
  onSyncRequested,
}: {
  onSyncRequested?: () => Promise<void>;
}) {
  const snapshot = useSyncExternalStore(
    subscribeToNetworkStatus,
    getNetworkStatusSnapshot,
    getNetworkStatusSnapshot,
  );
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    return subscribeToSyncQueue((count) => {
      setQueueCount(count);
    });
  }, []);

  const isOffline = snapshot.status === "offline";

  // Hide banner if online and no pending queue items
  if (snapshot.status === "online" && queueCount === 0) {
    return null;
  }

  const handleManualSync = async () => {
    if (!onSyncRequested || isSyncing) return;
    setIsSyncing(true);
    try {
      await onSyncRequested();
    } finally {
      setIsSyncing(false);
    }
  };

  const label = isOffline
    ? "You are working offline"
    : queueCount > 0
    ? "Pending sync items"
    : "Network is slow";

  const detail = isOffline
    ? queueCount > 0
      ? `${queueCount} pending change${queueCount > 1 ? "s" : ""} saved locally. Will auto-sync when online.`
      : "Viewing cached school pages. Changes will be saved locally."
    : queueCount > 0
    ? `${queueCount} pending change${queueCount > 1 ? "s" : ""} ready to sync.`
    : "Mobile data or school Wi‑Fi is slow — pages may take longer to load.";

  return (
    <div
      className={
        isOffline
          ? "border-b border-rose-200 bg-rose-50"
          : queueCount > 0
          ? "border-b border-sky-200 bg-sky-50"
          : "border-b border-amber-200 bg-amber-50"
      }
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <WifiOff className="h-4 w-4 shrink-0 text-slate-600" />
          <span
            className={
              isOffline
                ? "font-semibold text-rose-900"
                : queueCount > 0
                ? "font-semibold text-sky-900"
                : "font-semibold text-amber-900"
            }
          >
            {label}
          </span>
          <span
            className={
              isOffline
                ? "text-rose-700"
                : queueCount > 0
                ? "text-sky-700"
                : "text-amber-700"
            }
          >
            {detail}
          </span>
          <span className="text-xs text-slate-500">
            • Last synced {formatLastSynced(snapshot.lastSyncedAt)}
          </span>
        </div>

        {queueCount > 0 && !isOffline && onSyncRequested && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        )}
      </div>
    </div>
  );
}

function formatLastSynced(value: number | null) {
  if (!value) {
    return "not yet";
  }

  return new Date(value).toLocaleTimeString("en-ZM", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
