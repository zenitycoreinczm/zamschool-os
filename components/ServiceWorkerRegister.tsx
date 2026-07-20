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
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === "function") {
      const id = idleWindow.requestIdleCallback(register, { timeout: 4000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timer = globalThis.setTimeout(register, 1500);
    return () => globalThis.clearTimeout(timer);
  }, []);

  return null;
}
