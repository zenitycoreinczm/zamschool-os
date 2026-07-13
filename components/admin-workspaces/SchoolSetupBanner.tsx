"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";

const DISMISS_KEY = "zamschool.principal.setup.dismissed";

export type SchoolSetupStatus = {
  initialized: boolean;
  departments: number;
  permissionGroups: number;
  settings: number;
};

type SchoolSetupBannerProps = {
  loading: boolean;
  initializing: boolean;
  status: SchoolSetupStatus | null;
  lastResults: Record<string, { status: string; count?: number; error?: string }> | null;
  onInitialize: () => void;
  onDismiss: () => void;
};

export function readSetupBannerDismissed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

export function persistSetupBannerDismissed() {
  window.localStorage.setItem(DISMISS_KEY, "1");
}

export default function SchoolSetupBanner({
  loading,
  initializing,
  status,
  lastResults,
  onInitialize,
  onDismiss,
}: SchoolSetupBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const needsAttention =
    !status?.initialized ||
    (status?.departments ?? 0) < 1 ||
    (status?.permissionGroups ?? 0) < 1;

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        needsAttention
          ? "border-amber-200 bg-amber-50/80"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">
            School setup
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {needsAttention
              ? "Finish baseline setup before you delegate to staff"
              : "Baseline setup is complete"}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            As Head Teacher, confirm departments, permission groups, and default school settings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                Hide details <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                View checklist <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onInitialize}
            disabled={initializing || loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {initializing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {status?.initialized ? "Re-run setup" : "Run setup"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-700"
            aria-label="Dismiss setup reminder"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SetupMetric
            label="Departments"
            value={loading ? "…" : String(status?.departments ?? 0)}
            ready={(status?.departments ?? 0) > 0}
          />
          <SetupMetric
            label="Permission groups"
            value={loading ? "…" : String(status?.permissionGroups ?? 0)}
            ready={(status?.permissionGroups ?? 0) > 0}
          />
          <SetupMetric
            label="School settings"
            value={loading ? "…" : String(status?.settings ?? 0)}
            ready={(status?.settings ?? 0) > 0}
          />
        </div>
      ) : null}

      {expanded && lastResults ? (
        <div className="mt-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Latest setup run</p>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(lastResults).map(([key, result]) => (
              <li key={key}>
                <span className="font-medium text-slate-700">{key}</span>: {result.status}
                {typeof result.count === "number" ? ` (${result.count})` : ""}
                {result.error ? ` — ${result.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SetupMetric({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">{label}</p>
        {ready ? (
          <span className="text-[10px] font-semibold text-emerald-600">Ready</span>
        ) : null}
      </div>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}