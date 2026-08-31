"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type StatusState = "checking" | "operational" | "unavailable";

const PROBE_TIMEOUT_MS = 5000;

const toneClasses: Record<
  "dark" | "light",
  Record<StatusState, { pill: string; dot: string }>
> = {
  dark: {
    operational: {
      pill: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
      dot: "bg-emerald-400",
    },
    unavailable: {
      pill: "border-amber-500/20 bg-amber-500/10 text-amber-400",
      dot: "bg-amber-400",
    },
    checking: {
      pill: "border-white/10 bg-white/[0.03] text-slate-400",
      dot: "bg-slate-500",
    },
  },
  light: {
    operational: {
      pill: "border-emerald-600/25 bg-emerald-50 text-emerald-700",
      dot: "bg-emerald-500",
    },
    unavailable: {
      pill: "border-amber-600/25 bg-amber-50 text-amber-700",
      dot: "bg-amber-500",
    },
    checking: {
      pill: "border-slate-200 bg-slate-50 text-slate-500",
      dot: "bg-slate-400",
    },
  },
};

const statusLabels: Record<StatusState, string> = {
  operational: "All Systems Operational",
  unavailable: "System Status Unavailable",
  checking: "Checking System Status…",
};

/**
 * Live probe of /api/health. "unavailable" can also mean the visitor is
 * offline, so it never claims an outage - only that the status could not
 * be confirmed from this browser.
 */
export default function SystemStatusBadge({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const [status, setStatus] = useState<StatusState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    fetch("/api/health", { signal: controller.signal })
      .then((res) => setStatus(res.ok ? "operational" : "unavailable"))
      .catch(() => setStatus("unavailable"))
      .finally(() => window.clearTimeout(timeout));

    return () => controller.abort();
  }, []);

  const tone = toneClasses[variant][status];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 rounded-full border px-3 py-1", tone.pill)}
    >
      <span className="relative flex h-2 w-2">
        {status === "operational" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              tone.dot,
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            status === "checking" && "animate-pulse",
            tone.dot,
          )}
        />
      </span>
      <span className="min-w-0 break-words font-semibold">{statusLabels[status]}</span>
    </div>
  );
}