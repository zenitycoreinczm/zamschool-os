import { Loader2, RefreshCw } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

/**
 * Teacher desk hero, built on the shared AdminPageHero chrome.
 * Greeting banner only — no stat cards.
 */
export function TeacherDashboardHero({
  schoolName,
  displayName,
  yearTerm,
  refreshing,
  onRefresh,
}: {
  schoolName: string;
  displayName: string;
  yearTerm: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <AdminPageHero
      eyebrow="Classroom desk"
      title="Teaching day"
      description={`Welcome back, ${displayName}. ${schoolName} · `}
      descriptionExtra={
        <AcademicContextLabel
          value={yearTerm}
          yearClassName="font-medium text-slate-200"
          termClassName="text-slate-400"
        />
      }
      actions={
        <button
          type="button"
          onClick={onRefresh}
          aria-label="Refresh dashboard data"
          className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 p-2.5 text-white transition hover:bg-white/15"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      }
    />
  );
}
