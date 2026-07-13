"use client";

import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import type { WorkspaceMetric } from "@/lib/workspace/summary";
import { cn } from "@/lib/utils";

type WorkspaceMetricsRowProps = {
  metrics: WorkspaceMetric[];
  loading: boolean;
  /** @deprecated Decorative icons removed — prop kept for call-site compatibility */
  icons?: ComponentType<LucideProps>[];
  /** When 2, uses a balanced two-column row (principal command center). Default: 4-up grid. */
  columns?: 2 | 4;
};

const cardTones = [
  "from-sky-50/90 to-white border-sky-100/90",
  "from-violet-50/90 to-white border-violet-100/90",
  "from-amber-50/90 to-white border-amber-100/90",
  "from-emerald-50/90 to-white border-emerald-100/90",
];

function gridClass(columns: 2 | 4) {
  return columns === 2
    ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
    : "grid grid-cols-2 gap-3 lg:grid-cols-4";
}

export default function WorkspaceMetricsRow({
  metrics,
  loading,
  columns = 4,
}: WorkspaceMetricsRowProps) {
  const skeletonCount = columns === 2 ? 2 : 4;

  if (loading) {
    return (
      <div
        className={gridClass(columns)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading metrics"
      >
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className="workspace-skeleton-block min-h-[5.75rem] overflow-hidden rounded-workspace-xl p-4"
          >
            <div className="workspace-skeleton h-3 w-16 rounded-md" />
            <div className="workspace-skeleton mt-3 h-7 w-20 rounded-md" />
            <div className="workspace-skeleton mt-2 h-2.5 w-24 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass(columns)}>
      {metrics.map((metric, index) => {
        const surface = cardTones[index % cardTones.length];
        return (
          <div
            key={`${metric.label}-${index}`}
            className={cn(
              "rounded-workspace-xl border bg-gradient-to-br p-4 shadow-workspace-sm transition-shadow hover:shadow-workspace-md",
              surface,
            )}
          >
            <p className="ws-tabular text-2xl font-bold text-slate-950">
              {metric.value}
            </p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {metric.label}
            </p>
            {metric.hint ? (
              <p className="mt-0.5 text-[11px] text-slate-400">{metric.hint}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
