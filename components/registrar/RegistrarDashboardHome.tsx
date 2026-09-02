"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutGrid,
  Users,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import RoleSetupGuide, {
  useGuideDismissed,
} from "@/components/workspace/RoleSetupGuide";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import { buildRegistrarGuide } from "@/lib/workspace/role-onboarding";
import { schoolHeroStatsFromSummary } from "@/lib/workspace/metric-display";

const FALLBACK_LABELS = [
  { label: "Students", hint: "On directory" },
  { label: "Classes", hint: "Active classes" },
  { label: "Parents", hint: "Guardian accounts" },
  { label: "Absent (7d)", hint: "Lessons marked absent" },
];

const QUICK_ACTIONS = [
  {
    title: "Student directory",
    hint: "Profiles, admissions records, documents, and guardian links.",
    href: "/app/registrar/people",
    icon: Users,
  },
  {
    title: "Class placements",
    hint: "Assign learners to classes and streams — numbered classes keep roll call clear.",
    href: "/app/registrar/classes",
    icon: LayoutGrid,
  },
  {
    title: "Bulk import",
    hint: "CSV upload on People — students, teachers, or parents in one pass.",
    href: "/app/registrar/people?bulk=1",
    icon: FileSpreadsheet,
  },
  {
    title: "Attendance & enrolment",
    hint: "Enrolment status and early-term attendance overview.",
    href: "/app/admin/attendance",
    icon: ClipboardCheck,
  },
];

export default function RegistrarDashboardHome() {
  const workspace = useWorkspaceData();
  const { metrics, loading } = useWorkspaceSummary();
  const [guideDismissed, dismissGuide] = useGuideDismissed(
    "zamschool.guide.registrar.dismissed",
  );

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "the current term";
  const displayName = workspace?.displayName || "Registrar";

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    FALLBACK_LABELS,
    loading,
    { tone: "slate" },
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of metrics) {
      const n = Number(String(m.value).replace(/,/g, ""));
      if (Number.isFinite(n)) map[String(m.label || "").toLowerCase()] = n;
    }
    return {
      classCount: map.classes ?? 0,
      studentCount: map.students ?? 0,
      teacherCount: map.teachers ?? 0,
      parentCount: map.parents ?? 0,
    };
  }, [metrics]);

  const guide = useMemo(() => buildRegistrarGuide(counts), [counts]);
  const showGuide =
    !guideDismissed &&
    (counts.classCount < 1 ||
      counts.studentCount < 5 ||
      counts.teacherCount < 1);

  return (
    <div className="space-y-5 p-4 pb-8 md:p-6">
      <AdminPageHero
        eyebrow="Admissions desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Keep ${yearTerm} enrolment moving — register people, place learners, and keep family links current.`}
        accent="slate"
        stats={heroStats}
        actions={
          <>
            <Link
              href="/app/registrar/people"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Register student
            </Link>
            <Link
              href="/app/registrar/classes"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Classes
            </Link>
          </>
        }
      />

      {showGuide ? (
        <RoleSetupGuide guide={guide} onDismiss={dismissGuide} />
      ) : null}

      <section aria-label="Quick actions">
        <p className="ws-eyebrow text-slate-400">Quick actions</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.title}
                href={action.href}
                className="group flex items-start gap-3.5 rounded-workspace-2xl border border-slate-200 bg-white p-4 shadow-workspace-xs transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-workspace-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 transition-colors duration-150 group-hover:bg-slate-900 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {action.title}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-150 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {action.hint}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
