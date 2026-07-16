"use client";

import { Loader2, RefreshCw } from "lucide-react";

/**
 * Compact dashboard chrome - student name/class/number live in the shell sidebar.
 * This strip focuses on “today” context and refresh only.
 */
export function StudentDashboardHero({
  className,
  classNumber,
  refreshing,
  error,
  onRefresh,
  assignmentCount,
  urgentCount,
}: {
  className: string;
  classNumber: number | null;
  refreshing: boolean;
  error: string;
  onRefresh: () => void;
  assignmentCount?: number;
  urgentCount?: number;
}) {
  return (
    <section
      aria-labelledby="student-dashboard-hero-heading"
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-sm"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Today
          </p>
          <h1
            id="student-dashboard-hero-heading"
            className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]"
          >
            Your school day
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {className || "Class pending"}
            </span>
            {classNumber != null ? (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700 ring-1 ring-slate-200">
                No. {classNumber}
              </span>
            ) : null}
            {typeof assignmentCount === "number" ? (
              <span className="text-slate-500">
                {assignmentCount} assignment{assignmentCount === 1 ? "" : "s"}
                {urgentCount ? ` · ${urgentCount} due soon` : ""}
              </span>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="border-t border-slate-100 bg-rose-50 px-5 py-3 text-sm text-rose-700 sm:px-6"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
