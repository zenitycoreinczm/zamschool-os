"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";
import {
  resolveOfflineWarmupApis,
  resolveOfflineWarmupPages,
} from "@/lib/offline-support";
import { setNetworkOffline, setNetworkOnline } from "@/lib/network-status";
import {
  getSyncQueueCount,
  processSyncQueue,
} from "@/lib/offline-sync-queue";

const OFFLINE_WARMUP_KEY = "zamschool-offline-core-warmed-v3";

export default function OfflineStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useWorkspaceContext();
  const warmedForRef = useRef<string>("");
  const isSyncingRef = useRef<boolean>(false);

  // Sync queue runner when back online
  const triggerQueueSync = async () => {
    if (isSyncingRef.current || typeof window === "undefined" || !navigator.onLine) {
      return;
    }
    const pendingCount = getSyncQueueCount();
    if (pendingCount === 0) return;

    isSyncingRef.current = true;
    try {
      const result = await processSyncQueue();
      if (result.processed > 0) {
        toast.success(
          `Synced ${result.processed} offline change${result.processed > 1 ? "s" : ""} successfully!`,
          { id: "offline-sync-success" },
        );
      }
      if (result.failed > 0) {
        toast.error(
          `${result.failed} offline item${result.failed > 1 ? "s" : ""} failed to sync after retries.`,
          { id: "offline-sync-failed" },
        );
      }
    } catch (err) {
      console.warn("[OfflineSync] Queue processing error:", err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Failed to register offline service worker", error);
      });
    }

    const handleOnline = () => {
      setNetworkOnline();
      void triggerQueueSync();
    };

    const handleOffline = () => {
      setNetworkOffline();
    };

    if (navigator.onLine === false) {
      setNetworkOffline();
    } else {
      setNetworkOnline();
      // Check if there are queued items pending sync from a previous offline session
      void triggerQueueSync();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Wait for workspace identity so we never warm school APIs for platform super_admin.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (workspace?.loading) return;

    const role = workspace?.role || workspace?.data?.role || null;
    const schoolId = workspace?.data?.schoolId || null;
    const warmKey = `${String(role || "").toLowerCase()}:${String(schoolId || "").trim() || "none"}`;

    if (warmedForRef.current === warmKey) return;

    // Session key is per role+school so switching accounts still warms correctly.
    const sessionKey = `${OFFLINE_WARMUP_KEY}:${warmKey}`;
    if (window.sessionStorage.getItem(sessionKey) === "1") {
      warmedForRef.current = warmKey;
      return;
    }

    warmedForRef.current = warmKey;
    window.sessionStorage.setItem(sessionKey, "1");

    void warmOfflineCore({ role, schoolId });
  }, [
    workspace?.loading,
    workspace?.role,
    workspace?.data?.role,
    workspace?.data?.schoolId,
  ]);

  return (
    <>
      <OfflineStatusBanner onSyncRequested={triggerQueueSync} />
      {children}
    </>
  );
}

async function warmOfflineCore(params: {
  role?: string | null;
  schoolId?: string | null;
}) {
  if (typeof window === "undefined" || navigator.onLine === false) {
    return;
  }

  const pages = resolveOfflineWarmupPages(params);
  const apis = resolveOfflineWarmupApis(params);

  if (pages.length === 0 && apis.length === 0) {
    return;
  }

  // Stagger slightly so we do not stampede the dev compiler + Supabase budget.
  const pageWarmups = pages.map((path, index) =>
    delay(index * 40).then(() =>
      fetchWithOfflineSupport(path, {
        method: "GET",
        credentials: "include",
      }).catch(() => null),
    ),
  );

  const apiWarmups = apis.map((path, index) =>
    delay(80 + index * 50).then(() =>
      fetchWithOfflineSupport(path, {
        method: "GET",
        credentials: "same-origin",
      }).catch(() => null),
    ),
  );

  await Promise.allSettled([...pageWarmups, ...apiWarmups]);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
