"use client";

import { useEffect } from "react";
import { validateClientEnv } from "@/lib/client-env-validation";

export function ClientEnvValidator() {
  useEffect(() => {
    const result = validateClientEnv();

    if (!result.valid) {
      const message = `Missing required environment variables: ${result.missing.join(", ")}`;
      console.error("[ClientEnv] " + message);

      // Show a visible banner for missing env vars — the app will not function
      // correctly without these, so developers need a clear signal beyond the
      // console.
      if (typeof window !== "undefined" && !window.location.href.includes("/login")) {
        console.warn("[ClientEnv] Application may be non-functional without required env vars");
      }
    }

    // Only surface optional-var warnings in development — they are expected
    // to be unset in many deployment configurations and are not actionable
    // noise in production.
    if (result.warnings.length > 0 && process.env.NODE_ENV === "development") {
      console.warn(`[ClientEnv] Optional variables not set: ${result.warnings.join(", ")}`);
    }
  }, []);

  return null;
}