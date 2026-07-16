"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MoreHorizontal } from "lucide-react";
import { RadialBarChart, RadialBar } from "recharts";

import { ChartFrame } from "@/components/charts/ChartFrame";
import { useRouter } from "next/navigation";

import { isAbortLikeError } from "@/lib/async-guards";
import { fetchDashboardSummary } from "@/lib/dashboard-client";
import { useDashboardSummary } from "@/components/DashboardSummaryProvider";

type StudentTotals = {
  total: number;
  boys: number;
  girls: number;
  unspecified: number;
};

export default function CountChart() {
  const router = useRouter();
  const dashboard = useDashboardSummary();
  const [fallbackTotals, setFallbackTotals] = useState<StudentTotals | null>(
    null,
  );
  const summaryTotals = dashboard?.summary?.studentTotals ?? null;
  const totals = summaryTotals ??
    fallbackTotals ?? {
      total: 0,
      boys: 0,
      girls: 0,
      unspecified: 0,
    };
  const loading =
    !summaryTotals && !fallbackTotals && (dashboard?.loading ?? true);

  useEffect(() => {
    if (summaryTotals || dashboard?.loading) {
      return;
    }

    let cancelled = false;

    const loadStudentTotals = async () => {
      try {
        const summary = await fetchDashboardSummary();
        if (cancelled) return;
        setFallbackTotals(summary.studentTotals);
      } catch (error) {
        if (cancelled || isAbortLikeError(error)) return;
        console.error("Error loading student count chart:", error);
        setFallbackTotals({ total: 0, boys: 0, girls: 0, unspecified: 0 });
      }
    };

    void loadStudentTotals();

    return () => {
      cancelled = true;
    };
  }, [summaryTotals, dashboard?.loading]);

  const inferredBoys = totals.boys + Math.ceil(totals.unspecified / 2);
  const inferredGirls = totals.girls + Math.floor(totals.unspecified / 2);
  const displayBoys =
    totals.total > 0 && totals.boys + totals.girls === 0
      ? inferredBoys
      : totals.boys;
  const displayGirls =
    totals.total > 0 && totals.boys + totals.girls === 0
      ? inferredGirls
      : totals.girls;
  const displayTotal = displayBoys + displayGirls;
  const boysRate =
    displayTotal > 0 ? Math.round((displayBoys / displayTotal) * 100) : 0;
  const girlsRate =
    displayTotal > 0 ? Math.round((displayGirls / displayTotal) * 100) : 0;
  const chartData = useMemo(
    () => [
      { name: "Girls", count: displayGirls, fill: "var(--color-chart-girls)" },
      { name: "Boys", count: displayBoys, fill: "var(--color-chart-boys)" },
    ],
    [displayBoys, displayGirls],
  );

  return (
    <div className="bg-white rounded-workspace-xl w-full h-full min-h-[390px] p-5 flex flex-col shadow-sm border border-slate-100">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Students</h2>
        <button
          type="button"
          onClick={() => router.push("/app/registrar/people")}
          className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Open student enrolment (Registrar)"
          title="Students are enrolled by the Registrar"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
      <div className="relative mt-2 min-h-[280px] min-w-0">
        {loading ? (
          <div className="grid h-[280px] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : totals.total === 0 ? (
          <div className="grid h-[280px] place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
            <div>
              <p className="text-sm font-medium text-slate-600">
                No students yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Student totals will appear here after enrolment data is added.
              </p>
            </div>
          </div>
        ) : (
          <ChartFrame className="relative" minHeight={280}>
            {(size) => (
              <>
                <RadialBarChart
                  width={size.width}
                  height={size.height}
                  cx="50%"
                  cy="48%"
                  innerRadius="34%"
                  outerRadius="68%"
                  barSize={18}
                  data={chartData}
                >
                  <RadialBar background dataKey="count" />
                </RadialBarChart>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-5 rounded-full bg-chart-boys" />
                    <div className="h-10 w-5 rounded-full bg-chart-girls" />
                  </div>
                </div>
              </>
            )}
          </ChartFrame>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3">
        <div className="min-w-0 rounded-2xl bg-sky-50/70 px-3 py-3">
          <div className="w-4 h-4 bg-chart-boys rounded-full" />
          <p className="text-[2rem] leading-none font-bold text-slate-900">
            {displayBoys}
          </p>
          <h2 className="text-sm leading-snug font-medium text-slate-500">
            Boys ({boysRate}%)
          </h2>
        </div>
        <div className="min-w-0 rounded-2xl bg-amber-50/70 px-3 py-3">
          <div className="w-4 h-4 bg-chart-girls rounded-full" />
          <p className="text-[2rem] leading-none font-bold text-slate-900">
            {displayGirls}
          </p>
          <h2 className="text-sm leading-snug font-medium text-slate-500">
            Girls ({girlsRate}%)
          </h2>
        </div>
      </div>
      {totals.unspecified > 0 ? (
        <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
          {totals.unspecified} records need gender set in user management.
        </p>
      ) : null}
    </div>
  );
}
