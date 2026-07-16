"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ClipboardList,
  FileText,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Users,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import {
  formatSchoolStatValue,
  schoolHeroStatsFromSummary,
} from "@/lib/workspace/metric-display";

const MODULES = [
  {
    href: "/app/admin/timetable",
    title: "Review timetables",
    description: "Check class and teacher coverage for conflicts and gaps.",
    statKey: "classes" as const,
  },
  {
    href: "/app/admin/attendance",
    title: "Attendance trends",
    description: "Spot classes with unusual absence or lateness patterns.",
    statKey: "absent" as const,
  },
  {
    href: "/app/admin/assignments",
    title: "Assignments",
    description: "School-wide assignment overview before term reporting.",
    statKey: "assignments" as const,
  },
  {
    href: "/app/messages",
    title: "Messages",
    description: "Coordinate with academic leads and department heads.",
    statKey: "inbox" as const,
  },
  {
    href: "/app/announcements",
    title: "Announcements",
    description: "School notices visible to staff and families.",
    statKey: null,
  },
] as const;

const WORKFLOW = [
  "Review published timetables for conflicts and coverage gaps.",
  "Check attendance trends for classes with unusual absence patterns.",
  "Validate assignment completion before term reporting.",
  "Use Messages to coordinate follow-up with academic and department leads.",
];

export default function DeputyHeadDashboard() {
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
  const displayName = workspace?.displayName || "Deputy Head";

  const metricMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of metrics) {
      map[m.label.toLowerCase()] = m.value;
    }
    return map;
  }, [metrics]);

  const students = metricMap.students;
  const teachers = metricMap.teachers;
  const classes = metricMap.classes;
  const absent =
    metricMap["absent (7d)"] || metricMap.absent || metricMap["absent"];

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    [
      { label: "Students", hint: "Active on directory" },
      { label: "Teachers", hint: "Teaching accounts" },
      { label: "Classes", hint: "Active classes" },
      { label: "Absent (7d)", hint: "Lessons marked absent" },
    ],
    summaryLoading,
    { tone: "slate" },
  );

  const focusItems =
    highlights.length > 0
      ? highlights
      : [
          "Review timetables for coverage gaps",
          "Monitor attendance trends",
          "Check assignment completion",
          "Follow up via Messages",
        ];

  const areaStats: Record<string, string> = {
    classes: `${formatSchoolStatValue(classes, { loading: summaryLoading })} classes`,
    absent: `${formatSchoolStatValue(absent, { loading: summaryLoading })} absent (7d)`,
    students: `${formatSchoolStatValue(students, { loading: summaryLoading })} students`,
    assignments: summaryLoading ? "…" : "School-wide",
    inbox: summaryLoading ? "…" : "Open inbox",
  };

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
        eyebrow="Quality hub"
        title={schoolName}
        description={`Welcome back, ${displayName}. Oversee academic quality for ${yearTerm} - timetables, attendance, assignments, and people.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/timetable/classes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <CalendarClock className="h-4 w-4 text-sky-600" />
              Review timetables
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
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Modules
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Quality tools
            </h2>
          </div>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {MODULES.map((mod) => {
            const Icon = iconForModule(mod.href);
            const stat =
              mod.statKey && areaStats[mod.statKey]
                ? areaStats[mod.statKey]
                : null;
            return (
              <Link
                key={mod.href + mod.title}
                href={mod.href}
                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200/80">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{mod.title}</p>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {mod.description}
                  </p>
                  {stat ? (
                    <p className="mt-2 text-xs font-medium tabular-nums text-slate-600">
                      {stat}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Workflow guide</h2>
        <p className="mt-1 text-sm text-slate-500">
          Quality oversight checks for the current term.
        </p>
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
      </div>
    </div>
  );
}

function iconForModule(href: string) {
  if (href.includes("timetable")) return CalendarClock;
  if (href.includes("attendance")) return ClipboardList;
  if (href.includes("assignments")) return FileText;
  if (href.includes("users")) return Users;
  if (href.includes("messages")) return MessageSquare;
  if (href.includes("announcements")) return Megaphone;
  return ClipboardList;
}
