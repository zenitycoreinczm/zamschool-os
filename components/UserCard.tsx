"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { isAbortLikeError } from "@/lib/async-guards";
import { fetchDashboardSummary } from "@/lib/dashboard-client";
import { useDashboardSummary } from "@/components/DashboardSummaryProvider";
import { roleStatSurface, ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type UserCardType = keyof typeof roleStatSurface;

export default function UserCard({ type }: { type: UserCardType }) {
  const [fallbackSummary, setFallbackSummary] = useState<
    NonNullable<ReturnType<typeof useDashboardSummary>>["summary"] | null
  >(null);
  const router = useRouter();
  const dashboard = useDashboardSummary();
  const summary = dashboard?.summary ?? fallbackSummary;
  const count = summary?.roleCounts[type] ?? null;
  const academicLabel = summary?.academicLabel ?? "Current term";
  const loading = !summary && (dashboard?.loading ?? true);

  const handleClick = () => {
    router.push(`/app/admin/users?role=${encodeURIComponent(type)}`);
  };

  useEffect(() => {
    if (dashboard?.summary || dashboard?.loading) {
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const nextSummary = await fetchDashboardSummary();
        if (cancelled) return;
        setFallbackSummary(nextSummary);
      } catch (err) {
        if (cancelled || isAbortLikeError(err)) return;
        console.error(`Error fetching ${type} count:`, err);
        setFallbackSummary({
          schoolId: "",
          academicLabel: "Current term",
          roleCounts: { admin: 0, teacher: 0, student: 0, parent: 0 },
          studentTotals: { total: 0, boys: 0, girls: 0, unspecified: 0 },
        });
      }
    };

    void fetchCount();

    return () => {
      cancelled = true;
    };
  }, [type, dashboard?.summary, dashboard?.loading]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "group ws-card-glow ws-hover-lift min-w-[8.125rem] rounded-workspace-xl border bg-gradient-to-br p-4 text-left shadow-workspace-sm focus-visible:shadow-workspace-focus relative overflow-hidden backdrop-blur-sm",
        roleStatSurface[type]
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex max-w-[10.5rem] items-baseline gap-1 truncate rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-2xs ring-1 ring-black/5">
          <AcademicContextLabel
            value={academicLabel}
            yearClassName="text-[10px] font-semibold text-slate-800"
            termClassName="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500"
          />
        </span>
        <span
          className="text-slate-500/80 transition group-hover:scale-110 group-hover:text-slate-900"
          aria-hidden
        >
          <MoreHorizontal className="h-5 w-5" />
        </span>
      </div>
      <p className={cn("mt-4 text-[2rem] font-bold leading-none tracking-tight text-slate-900", ws.tabular)}>
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" aria-label="Loading count" />
        ) : (
          (count ?? 0).toLocaleString()
        )}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-slate-700">{type}s</p>
        <span className="text-[11px] font-medium text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">View &rarr;</span>
      </div>
    </button>
  );
}