/**
 * Client-side effect that bootstraps the Supabase fetch guard.
 *
 * Place this in the root layout or any client boundary to ensure
 * ALL browser-side fetch calls to *.supabase.co are not  rate-limited
 * by the global fetch interceptor.
 */
"use client";

import { useEffect } from "react";

export default function SupabaseGuardBootstrap() {
  useEffect(() => {
    // Dynamic import to avoid circular deps - installs the fetch guard
    // that intercepts ALL *.supabase.co HTTP requests globally
    import("@/lib/supabase-fetch-guard")
      .then((m) => {
        m.installSupabaseFetchGuard();
        if (typeof window !== "undefined") {
          console.debug("[SupabaseGuard] Client fetch guard installed.");
        }
      })
      .catch((err) => {
        console.warn("[SupabaseGuard] Failed to install client fetch guard:", err);
      });
  }, []);

  return null;
}
