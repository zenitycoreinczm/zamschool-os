import Link from "next/link";
import { Loader2, RefreshCw } from "lucide-react";

import { AdminPageHero, type AdminStatCard } from "@/components/admin/AdminPageHero";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type Stats = {
  lessons: number;
  students: number;
  completed: number;
  pending: number;
};

/**
 * Teacher desk hero, built on the shared AdminPageHero chrome (glow blobs,
 * dot pattern, ws-eyebrow, backdrop-blur stat rail) so every staff desk
 * feels like one product. Stats stay teacher-specific (own lessons and
 * roll-call state) instead of the school-wide summary.
 */
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
  const statItems: AdminStatCard[] = [
    { label: "Lessons today", value: stats.lessons },
    { label: "My students", value: stats.students },
    { label: "Roll calls done", value: stats.completed },
    { label: "Still pending", value: stats.pending },
  ];

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
      stats={statItems}
      actions={
        <>
          <Link
            href="/app/teacher/attendance"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Take attendance
          </Link>
          <Link
            href="/app/teacher/results"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Record results
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh dashboard data"
            className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/10 p-2 text-white transition hover:bg-white/15"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </>
      }
    />
  );
}
