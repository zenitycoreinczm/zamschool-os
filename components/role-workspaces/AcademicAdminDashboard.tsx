"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

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

const MODULES = [
  {
    href: "/app/admin/timetable/classes",
    title: "Class timetable",
    description: "Weekly slots by class.",
  },
  {
    href: "/app/admin/timetable/teachers",
    title: "Teacher timetable",
    description: "Coverage and conflicts by teacher.",
  },
  {
    href: "/app/admin/academic",
    title: "Years & terms",
    description: "Academic calendar structure.",
  },
  {
    href: "/app/admin/subjects",
    title: "Subjects",
    description: "Curriculum subject catalogue.",
  },
  {
    href: "/app/admin/grading-scales",
    title: "Grading scales",
    description: "ECZ-aligned grade bands.",
  },
  {
    href: "/app/admin/assignments",
    title: "Assignments",
    description: "School-wide assignment overview.",
  },
];

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

  const focusItems =
    highlights.length > 0 ? highlights : FOCUS_AREAS;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSummary();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5 p-4 pb-8 md:p-6">
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
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              {refreshing || summaryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
          </div>
        }
      />

      <FocusPills items={focusItems} accent="slate" />

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{mod.title}</p>
              <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Workflow guide</h2>
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
      </div>
    </div>
  );
}
