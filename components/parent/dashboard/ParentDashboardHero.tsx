import { Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  RANGE_OPTIONS,
  type ParentChildRow,
  type ParentRangeValue,
} from "@/components/parent/dashboard/types";

export function ParentDashboardHero({
  linkedChildren,
  range,
  onChangeRange,
  selectedChildId,
  onChangeChild,
  refreshing,
  error,
  onRefresh,
}: {
  linkedChildren: ParentChildRow[];
  range: ParentRangeValue;
  onChangeRange: (value: ParentRangeValue) => void;
  selectedChildId: string;
  onChangeChild: (value: string) => void;
  refreshing: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const childCount = linkedChildren.length;

  return (
    <section
      aria-labelledby="parent-dashboard-hero-heading"
      className="overflow-hidden rounded-3xl border border-slate-800/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-sm"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Family
          </p>
          <h1
            id="parent-dashboard-hero-heading"
            className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.65rem]"
          >
            Your children
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-300">
            <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-100 ring-1 ring-white/10">
              {childCount === 0
                ? "No linked children"
                : `${childCount} linked child${childCount === 1 ? "" : "ren"}`}
            </span>
            <span className="text-slate-400">
              Attendance, results, and school updates
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-slate-100">
            <select
              value={selectedChildId}
              onChange={(event) => onChangeChild(event.target.value)}
              className="max-w-[12rem] bg-transparent pr-2 text-sm text-white outline-none sm:max-w-[14rem]"
              aria-label="Select linked child"
            >
              <option value="all" className="text-slate-900">
                All children
              </option>
              {linkedChildren.map((child) => (
                <option
                  key={child.id}
                  value={child.id}
                  className="text-slate-900"
                >
                  {child.displayName}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div
        className="flex flex-wrap gap-2 border-t border-white/10 bg-black/20 px-5 py-3 sm:px-6"
        role="group"
        aria-label="Date range"
      >
        {RANGE_OPTIONS.map((option) => {
          const active = option.value === range;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChangeRange(option.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:text-sm",
                active
                  ? "bg-white text-slate-900"
                  : "border border-white/15 bg-transparent text-slate-300 hover:bg-white/10",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div
          role="alert"
          className="border-t border-white/10 bg-rose-500/15 px-5 py-3 text-sm text-rose-100 sm:px-6"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
