"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker on every surface (landing + app).
 * Landing visitors need this so / and CSS can warm into cache for flaky mobile
 * networks; authenticated shells also register via OfflineStatusProvider — a
 * second register() is a no-op for the same script URL.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.warn("[sw] registration failed", error);
      });
    };

    // Defer so first paint / CSS are not competing with SW install on 2G/3G.
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(register, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = window.setTimeout(register, 1500);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
