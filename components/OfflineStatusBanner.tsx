"use client";

import { useSyncExternalStore } from "react";

import {
  getNetworkStatusSnapshot,
  subscribeToNetworkStatus,
} from "@/lib/network-status";

export default function OfflineStatusBanner() {
  const snapshot = useSyncExternalStore(subscribeToNetworkStatus, getNetworkStatusSnapshot, getNetworkStatusSnapshot);

  if (snapshot.status === "online") {
    return null;
  }

  const isOffline = snapshot.status === "offline";
  const label = isOffline ? "You are offline" : "Network is slow";
  const detail = isOffline
    ? "You can still open recently used school pages. Changes cannot be saved until you reconnect."
    : "Mobile data or school Wi‑Fi is slow — pages may take longer to load.";

  return (
    <div
      className={
        isOffline
          ? "border-b border-rose-200 bg-rose-50"
          : "border-b border-amber-200 bg-amber-50"
      }
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <span
          className={
            isOffline
              ? "font-semibold text-rose-800"
              : "font-semibold text-amber-800"
          }
        >
          {label}
        </span>
        <span className={isOffline ? "text-rose-700" : "text-amber-700"}>
          {detail}
        </span>
        <span className={isOffline ? "text-rose-700" : "text-amber-700"}>
          Last synced {formatLastSynced(snapshot.lastSyncedAt)}
        </span>
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
