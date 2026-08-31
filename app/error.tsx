"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkLoadError =
    error?.name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(error?.message || "") ||
    /Failed to fetch dynamically imported module/i.test(error?.message || "") ||
    /Invalid or unexpected token/i.test(error?.message || "");

  useEffect(() => {
    // Never log full error objects in production (may include stack / paths).
    if (process.env.NODE_ENV !== "production") {
      console.error("Global error caught:", error?.digest || error?.name);
    }

    // Stale webpack/HMR chunks after deploy or heavy edits - one hard reload.
    if (typeof window === "undefined" || !isChunkLoadError) return;
    const key = "zamschool:chunk-reload";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } catch {
      // ignore storage failures
    }
  }, [error, isChunkLoadError]);

  useEffect(() => {
    if (typeof window === "undefined" || isChunkLoadError) return;
    try {
      sessionStorage.removeItem("zamschool:chunk-reload");
    } catch {
      // ignore
    }
  }, [isChunkLoadError]);

  const showDevDetail =
    process.env.NODE_ENV !== "production" && Boolean(error?.message);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-workspace-2xl border border-slate-200 bg-white p-8 text-center shadow-workspace-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-100">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>

        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
          {isChunkLoadError ? "App update needed" : "Something went wrong"}
        </h1>

        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {isChunkLoadError
            ? "The page script is out of date (common after a restart or large code change). Reload to load a fresh build."
            : "We apologize for the inconvenience. An unexpected error occurred. Please try again or return home."}
        </p>

        {showDevDetail ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
            <p className="break-all text-xs font-mono leading-relaxed text-slate-600">
              {error.message}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            onClick={() => {
              if (isChunkLoadError && typeof window !== "undefined") {
                window.location.reload();
                return;
              }
              reset();
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-hover"
          >
            <RefreshCcw className="h-4 w-4" />
            {isChunkLoadError ? "Reload app" : "Try Again"}
          </button>

          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Home className="h-4 w-4" />
            Return home
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Error ID: {error.digest || "unknown"}
        </p>
      </div>
    </div>
  );
}
