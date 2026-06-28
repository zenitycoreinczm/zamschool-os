"use client";

import { Loader2, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { WorkspaceMetric } from "@/lib/workspace/summary";
import { cn } from "@/lib/utils";

type WorkspaceMetricsRowProps = {
  metrics: WorkspaceMetric[];
  loading: boolean;
  icons: ComponentType<LucideProps>[];
  /** When 2, uses a balanced two-column row (principal command center). Default: 4-up grid. */
  columns?: 2 | 4;
};

const cardTones = [
  "from-sky-50/90 to-white border-sky-100/90",
  "from-violet-50/90 to-white border-violet-100/90",
  "from-amber-50/90 to-white border-amber-100/90",
  "from-emerald-50/90 to-white border-emerald-100/90",
];

const iconTones = ["text-sky-600", "text-violet-600", "text-amber-600", "text-emerald-600"];

function gridClass(columns: 2 | 4) {
  return columns === 2
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
    : "grid grid-cols-2 gap-3 lg:grid-cols-4";
}

export default function WorkspaceMetricsRow({
  metrics,
  loading,
  icons,
  columns = 4,
}: WorkspaceMetricsRowProps) {
  const skeletonCount = columns === 2 ? 2 : 4;

  if (loading) {
    return (
      <div className={gridClass(columns)}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className="flex min-h-[5.75rem] items-center justify-center rounded-workspace-xl border border-workspace-border bg-white shadow-workspace-xs"
          >
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass(columns)}>
      {metrics.map((metric, index) => {
        const Icon = icons[index % icons.length];
        const surface = cardTones[index % cardTones.length];
        const iconTone = iconTones[index % iconTones.length];
        return (
          <div
            key={`${metric.label}-${index}`}
            className={cn(
              "rounded-workspace-xl border bg-gradient-to-br p-4 shadow-workspace-sm transition-shadow hover:shadow-workspace-md",
              surface
            )}
          >
            <Icon className={cn("h-4 w-4", iconTone)} strokeWidth={1.75} />
            <p className="ws-tabular mt-2 text-2xl font-bold text-slate-950">{metric.value}</p>
            <p className="text-xs font-medium text-slate-600">{metric.label}</p>
            {metric.hint ? <p className="mt-0.5 text-[11px] text-slate-400">{metric.hint}</p> : null}
          </div>
        );
      })}
    </div>
  );
}