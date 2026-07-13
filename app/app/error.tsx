"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function WorkspaceError({
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
    if (process.env.NODE_ENV !== "production") {
      console.error("Workspace error caught:", error?.digest || error?.name);
    }

    if (typeof window === "undefined" || !isChunkLoadError) return;
    const key = "zamschool:chunk-reload";
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      window.location.reload();
    } catch {
      // ignore
    }
  }, [error, isChunkLoadError]);

  const showDevDetail =
    process.env.NODE_ENV !== "production" && Boolean(error?.message);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {isChunkLoadError ? "App update needed" : "Something went wrong"}
        </h1>

        <p className="mb-6 text-sm leading-relaxed text-slate-600">
          {isChunkLoadError
            ? "The page script is out of date after a rebuild. Reload to continue."
            : "This school page failed to load. Try again. If it keeps happening on school Wi-Fi, check your connection or open the page on another device."}
        </p>

        {showDevDetail ? (
          <div className="mb-6 rounded-lg bg-slate-100 p-3 text-left">
            <p className="break-all text-xs font-mono text-slate-700">
              {error.message}
            </p>
          </div>
        ) : null}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => {
              if (isChunkLoadError && typeof window !== "undefined") {
                window.location.reload();
                return;
              }
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 font-medium text-white transition-colors hover:bg-brand-hover"
          >
            {isChunkLoadError ? "Reload app" : "Try again"}
          </button>

          <Link
            href="/app/dashboard"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Go to dashboard
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Error ID: {error.digest || "unknown"} — share this with support if the
          problem continues.
        </p>
      </div>
    </div>
  );
}
