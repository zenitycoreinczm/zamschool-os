"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import Announcements from "@/components/Announcements";
import { ParentProgressSummary } from "@/components/parent/dashboard/ParentProgressSummary";
import ParentAttendanceSummary from "@/components/ParentAttendanceSummary";
import ParentChildAttendanceTable from "@/components/ParentChildAttendanceTable";
import { ParentDashboardHero } from "@/components/parent/dashboard/ParentDashboardHero";
import { ParentLinkedChildren } from "@/components/parent/dashboard/ParentLinkedChildren";
import { ParentPublishedResults } from "@/components/parent/dashboard/ParentPublishedResults";
import RoleSetupGuide, {
  persistGuideDismissed,
  readGuideDismissed,
} from "@/components/workspace/RoleSetupGuide";
import { formatLocalDateInputValue } from "@/lib/local-date";
import { buildParentGuide } from "@/lib/workspace/role-onboarding";
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

  // Hooks must run before any early return (loading gate).
  const absentCount =
    Number(summary?.ABSENT ?? 0) + Number(summary?.LATE ?? 0);
  const [guideDismissed, setGuideDismissed] = useState(true);
  useEffect(() => {
    setGuideDismissed(readGuideDismissed("zamschool.guide.parent.dismissed"));
  }, []);
  const guide = useMemo(
    () =>
      buildParentGuide({
        hasChildren: children.length > 0,
        hasResults: (results?.length ?? 0) > 0,
        absentCount,
      }),
    [children.length, results, absentCount],
  );
  const showGuide = !guideDismissed && (children.length === 0 || absentCount > 0);

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

      {absentCount > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Attendance alert</p>
          <p className="mt-1 text-xs leading-5 text-amber-900/85">
            {absentCount} absent or late mark
            {absentCount === 1 ? "" : "s"} in this range. Teachers submit roll
            call during each lesson — you are notified for every status,
            including present.
          </p>
          <Link
            href="/app/parent/attendance"
            className="mt-2 inline-flex text-xs font-semibold text-amber-900 underline underline-offset-2"
          >
            View attendance detail
          </Link>
        </div>
      ) : null}

      {showGuide ? (
        <RoleSetupGuide
          guide={guide}
          onDismiss={() => {
            persistGuideDismissed(guide.storageKey);
            setGuideDismissed(true);
          }}
        />
      ) : null}

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
          <ParentProgressSummary />
          <Announcements />
        </div>
      </div>
    </div>
  );
}
