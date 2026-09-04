"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileBarChart2,
  GraduationCap,
  Loader2,
  RefreshCw,
  Scale,
  Users,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import { schoolHeroStatsFromSummary } from "@/lib/workspace/metric-display";

const FOCUS_AREAS = [
  "Class timetables",
  "Teacher schedules",
  "Years & terms",
  "Subjects & grading",
  "Assignments",
];

const WORKFLOW = [
  "Set academic years and terms under Years & terms.",
  "Maintain subjects and grading scales under Curriculum.",
  "Build class and teacher timetables for the term.",
  "Publish assignments once classes exist (Registrar owns class creation).",
];

// Monochrome slate icon tiles - the registrar quick-action pattern. One
// accent: the icon inverts to slate-900 on hover. No rainbow tones.
const MODULES = [
  {
    href: "/app/admin/timetable/classes",
    title: "Class timetable",
    description: "Weekly slots by class.",
    icon: GraduationCap,
  },
  {
    href: "/app/admin/timetable/teachers",
    title: "Teacher timetable",
    description: "Coverage and conflicts by teacher.",
    icon: Users,
  },
  {
    href: "/app/admin/academic",
    title: "Years & terms",
    description: "Academic calendar structure.",
    icon: CalendarClock,
  },
  {
    href: "/app/admin/subjects",
    title: "Subjects",
    description: "Curriculum subject catalogue.",
    icon: ClipboardList,
  },
  {
    href: "/app/admin/grading-scales",
    title: "Grading scales",
    description: "ECZ-aligned grade bands.",
    icon: Scale,
  },
  {
    href: "/app/admin/assignments",
    title: "Assignments",
    description: "School-wide assignment overview.",
    icon: FileBarChart2,
  },
] as const;

export default function AcademicAdminDashboard() {
  const workspace = useWorkspaceData();
  const {
    metrics,
    highlights,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useWorkspaceSummary();
  const [refreshing, setRefreshing] = useState(false);

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "this term";
  const displayName = workspace?.displayName || "Academic administrator";

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    [
      { label: "Classes", hint: "Active classes" },
      { label: "Subjects", hint: "Curriculum catalogue" },
      { label: "Assignments", hint: "School-wide" },
      { label: "Teachers", hint: "Teaching accounts" },
    ],
    summaryLoading,
    { tone: "slate" },
  );

  const focusItems = highlights.length > 0 ? highlights : FOCUS_AREAS;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSummary();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="animate-enter-up space-y-5 p-4 pb-8 md:p-6">
      <AdminPageHero
        eyebrow="Academic desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Curriculum, timetables, and assessments for ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/timetable/classes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Class timetables
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => void onRefresh()}
              aria-label="Refresh metrics"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 p-2 text-white transition hover:bg-white/15"
            >
              {refreshing || summaryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
        }
      />

      <FocusPills items={focusItems} accent="slate" />

      <section aria-label="Academic modules">
        <p className="ws-eyebrow text-slate-400">Modules</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className="group flex items-start gap-3.5 rounded-workspace-2xl border border-slate-200 bg-white p-4 shadow-workspace-xs transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-workspace-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 transition-colors duration-150 group-hover:bg-slate-900 group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {mod.title}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-150 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {mod.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-workspace-2xl border border-slate-200 bg-white p-5 shadow-workspace-xs sm:p-6">
        <p className="ws-eyebrow text-slate-400">Workflow</p>
        <h2 className="mt-1 text-base font-semibold text-slate-900">
          Term setup sequence
        </h2>
        <ol className="mt-3 space-y-2">
          {WORKFLOW.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 text-sm text-slate-600"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold tabular-nums text-slate-500">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
