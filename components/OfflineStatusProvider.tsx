"use client";

import { useEffect, useRef } from "react";

import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";
import {
  resolveOfflineWarmupApis,
  resolveOfflineWarmupPages,
} from "@/lib/offline-support";
import { setNetworkOffline, setNetworkOnline } from "@/lib/network-status";

const OFFLINE_WARMUP_KEY = "zamschool-offline-core-warmed-v2";

export default function OfflineStatusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useWorkspaceContext();
  const warmedForRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("Failed to register offline service worker", error);
      });
    }

    const handleOnline = () => setNetworkOnline();
    const handleOffline = () => setNetworkOffline();

    if (navigator.onLine === false) {
      setNetworkOffline();
    } else {
      setNetworkOnline();
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
      <OfflineStatusBanner />
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
        cache: "no-store",
      }).catch(() => null),
    ),
  );

  const apiWarmups = apis.map((path, index) =>
    delay(80 + index * 50).then(() =>
      fetchWithOfflineSupport(path, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => null),
    ),
  );

  await Promise.allSettled([...pageWarmups, ...apiWarmups]);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
