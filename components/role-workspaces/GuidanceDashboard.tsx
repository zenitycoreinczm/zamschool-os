"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Loader2,
  MessageSquare,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import { schoolHeroStatsFromSummary } from "@/lib/workspace/metric-display";

const MODULES = [
  {
    href: "/app/admin/users",
    title: "Student directory",
    description: "Profiles and guardian context for welfare follow-up.",
  },
  {
    href: "/app/admin/attendance",
    title: "Attendance signals",
    description: "Absence and lateness patterns that may need support.",
  },
  {
    href: "/app/discipline-admin",
    title: "Conduct records",
    description: "Review and document behaviour cases with sensitivity.",
  },
  {
    href: "/app/messages",
    title: "Messages",
    description: "Coordinate privately with staff and leadership.",
  },
  {
    href: "/app/announcements",
    title: "Announcements",
    description: "School-wide notices relevant to families and students.",
  },
  {
    href: "/app/events",
    title: "Events",
    description: "School calendar items that may affect welfare plans.",
  },
] as const;

const WORKFLOW = [
  "Review attendance signals for students who may need support.",
  "Open conduct records to document or follow up on behaviour concerns.",
  "Use the student directory for guardian context before outreach.",
  "Coordinate with teachers and leadership via Messages.",
];

export default function GuidanceDashboard() {
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
  const displayName = workspace?.displayName || "Guidance officer";

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    [
      { label: "Students", hint: "On directory" },
      { label: "Absent (7d)", hint: "Lessons marked absent" },
      { label: "Late (7d)", hint: "Lessons marked late" },
      { label: "Inbox", hint: "Unread messages" },
    ],
    summaryLoading,
    { tone: "slate" },
  );

  const focusItems =
    highlights.length > 0
      ? highlights
      : [
          "Protect student welfare",
          "Review attendance signals",
          "Document conduct concerns",
          "Coordinate support via Messages",
        ];

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
        eyebrow="Guidance office"
        title={schoolName}
        description={`Welcome back, ${displayName}. Student welfare desk for ${yearTerm} — attendance signals, conduct follow-up, and sensitive coordination.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/discipline-admin"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <Shield className="h-4 w-4 text-sky-700" />
              Conduct records
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Modules
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          Welfare tools
        </h2>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {MODULES.map((mod) => (
            <Link
              key={mod.href}
              href={mod.href}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{mod.title}</p>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {mod.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Workflow guide</h2>
        <ol className="mt-3 space-y-2">
          {WORKFLOW.map((step, index) => (
            <li
              key={step}
              className="flex items-start gap-3 text-sm text-slate-600"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Treat conduct and attendance data as confidential. Share only with
          people who need it for the student’s welfare.
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
          <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Discipline Admin remains the primary owner of school-wide conduct
          policy; Guidance uses the same records for counselling follow-up.
        </p>
        <p className="mt-2 flex items-start gap-2 text-xs text-slate-500">
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Prefer Messages for sensitive coordination rather than public
          announcements.
        </p>
      </div>
    </div>
  );
}
