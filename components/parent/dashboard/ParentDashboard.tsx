"use client";

import { Loader2 } from "lucide-react";

import Announcements from "@/components/Announcements";
import ParentAttendanceSummary from "@/components/ParentAttendanceSummary";
import ParentChildAttendanceTable from "@/components/ParentChildAttendanceTable";
import { ParentDashboardHero } from "@/components/parent/dashboard/ParentDashboardHero";
import { ParentLinkedChildren } from "@/components/parent/dashboard/ParentLinkedChildren";
import { ParentPublishedResults } from "@/components/parent/dashboard/ParentPublishedResults";
import { formatLocalDateInputValue } from "@/lib/local-date";
import { useParentDashboard } from "@/components/parent/dashboard/useParentDashboard";

export default function ParentDashboard() {
  const {
    range,
    setRange,
    selectedChildId,
    setSelectedChildId,
    children,
    attendance,
    results,
    loading,
    refreshing,
    resultsLoading,
    resultsError,
    refresh,
    summaryHeading,
    rangeLabel,
    summary,
    childSummaries,
    error,
  } = useParentDashboard();

  if (loading) {
    return (
      <div
        className="flex-1 space-y-6 p-4 md:p-6"
        role="status"
        aria-live="polite"
      >
        <section className="grid place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 text-sm text-slate-500 shadow-sm">
          <Loader2 className="mb-3 h-5 w-5 animate-spin text-slate-500" />
          Loading family dashboard…
        </section>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 p-4 md:space-y-6 md:p-6">
      <ParentDashboardHero
        linkedChildren={children}
        range={range}
        onChangeRange={setRange}
        selectedChildId={selectedChildId}
        onChangeChild={setSelectedChildId}
        refreshing={refreshing}
        error={error}
        onRefresh={() => void refresh()}
      />

      <ParentAttendanceSummary
        summary={summary}
        heading={summaryHeading}
        rangeLabel={rangeLabel}
        startDate={attendance?.startDate || formatLocalDateInputValue()}
        endDate={attendance?.endDate || formatLocalDateInputValue()}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
        <div className="space-y-5 md:space-y-6">
          <ParentLinkedChildren
            linkedChildren={children}
            childSummaries={childSummaries}
            selectedChildId={selectedChildId}
            onSelectChild={setSelectedChildId}
          />

          <ParentChildAttendanceTable rows={attendance?.rows || []} />

          <ParentPublishedResults
            results={results}
            loading={resultsLoading}
            error={resultsError}
          />
        </div>

        <div className="space-y-5 md:space-y-6">
          <Announcements />
        </div>
      </div>
    </div>
  );
}
