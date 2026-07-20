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
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-sm"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Family
          </p>
          <h1
            id="parent-dashboard-hero-heading"
            className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.65rem]"
          >
            Your children
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
              {childCount === 0
                ? "No linked children"
                : `${childCount} linked child${childCount === 1 ? "" : "ren"}`}
            </span>
            <span className="text-slate-500">
              Notified when they arrive · results instantly · live attendance
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <select
              value={selectedChildId}
              onChange={(event) => onChangeChild(event.target.value)}
              className="max-w-[12rem] bg-transparent pr-2 text-sm text-slate-800 outline-none sm:max-w-[14rem]"
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
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
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
        className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-6"
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
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
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
          className="border-t border-slate-100 bg-rose-50 px-5 py-3 text-sm text-rose-700 sm:px-6"
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
