import { Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type Stats = {
  lessons: number;
  students: number;
  completed: number;
  pending: number;
};

export function TeacherDashboardHero({
  schoolName,
  displayName,
  yearTerm,
  stats,
  refreshing,
  onRefresh,
}: {
  schoolName: string;
  displayName: string;
  yearTerm: string;
  stats: Stats;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const statItems = [
    { key: "lessons", label: "Lessons today", value: stats.lessons },
    { key: "students", label: "Students", value: stats.students },
    { key: "completed", label: "Completed", value: stats.completed },
    { key: "pending", label: "Pending", value: stats.pending },
  ];

  return (
    <section
      aria-labelledby="teacher-dashboard-hero-heading"
      className="overflow-hidden rounded-3xl border border-slate-800/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-sm"
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Today
          </p>
          <h1
            id="teacher-dashboard-hero-heading"
            className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.65rem]"
          >
            Teaching day
          </h1>
          <p className="mt-2 flex max-w-2xl flex-wrap items-baseline gap-x-1.5 text-sm text-slate-300">
            <span>{schoolName}</span>
            <span className="text-slate-600">·</span>
            <AcademicContextLabel
              value={yearTerm}
              yearClassName="font-medium text-slate-200"
              termClassName="text-slate-400"
            />
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Welcome back, {displayName} · Designed so you don&apos;t need training
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/15"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-4">
        {statItems.map((item) => (
          <div
            key={item.key}
            className="bg-slate-900/80 px-4 py-3.5 sm:px-5 sm:py-4"
          >
            <p className="text-xl font-semibold tabular-nums tracking-tight text-white sm:text-2xl">
              {item.value}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-slate-400">
              {item.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
