"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  ClipboardList,
  GraduationCap,
  Loader2,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Shield,
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

const QUALITY_MODULES = [
  {
    href: "/app/admin/timetable/classes",
    title: "Class Timetables",
    description: "Inspect weekly class schedules and period coverage across streams.",
    icon: GraduationCap,
    statKey: "classes" as const,
  },
  {
    href: "/app/admin/timetable/teachers",
    title: "Teacher Schedules",
    description: "Verify teaching allocations, free periods, and prevent workload clashes.",
    icon: CalendarClock,
    statKey: "teachers" as const,
  },
  {
    href: "/app/admin/attendance",
    title: "Attendance Signals",
    description: "Monitor school-wide present rates, lateness patterns, and lesson roll calls.",
    icon: ClipboardList,
    statKey: "absent" as const,
  },
  {
    href: "/app/admin/academic",
    title: "Calendar & Terms",
    description: "Review academic years, term dates, and official school calendar cycles.",
    icon: Calendar,
    statKey: null,
  },
] as const;

const STANDARDS_MODULES = [
  {
    href: "/app/discipline-admin",
    title: "Conduct & Incident Desk",
    description: "Investigate, resolve, and document student behaviour incidents and actions.",
    icon: Shield,
    badge: "Disciplinary authority",
  },
  {
    href: "/app/admin/classes",
    title: "Classes & Streams",
    description: "Examine active class streams, student enrollments, and class supervisors.",
    icon: Users,
    badge: "Enrollment oversight",
  },
] as const;

const COMMS_MODULES = [
  {
    href: "/app/messages",
    title: "Staff Messages",
    description: "Direct confidential coordination with teachers, HODs, and Head Teacher.",
    icon: MessageSquare,
  },
  {
    href: "/app/announcements",
    title: "School Notices",
    description: "Broadcast announcements to teachers, parents, and secondary learners.",
    icon: Megaphone,
  },
  {
    href: "/app/events",
    title: "School Events",
    description: "Manage assemblies, ECZ testing dates, open days, and extra-curriculars.",
    icon: Calendar,
  },
] as const;

const QUALITY_WORKFLOW = [
  "Verify class and teacher timetables for complete syllabus coverage and zero period clashes.",
  "Track daily roll call compliance and investigate classes with unusual absence or lateness spikes.",
  "Oversee student conduct cases and ensure interventions align with Ministry and school codes.",
  "Maintain regular liaison with Academic Head and Guidance Counselor via internal messaging.",
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
  const displayName = workspace?.displayName || "Deputy Head Teacher";

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
      { label: "Students", hint: "Learners on roll" },
      { label: "Teachers", hint: "Teaching staff" },
      { label: "Classes", hint: "Active streams" },
      { label: "Absent (7d)", hint: "Absences flagged" },
    ],
    summaryLoading,
    { tone: "slate" },
  );

  const focusItems =
    highlights.length > 0
      ? highlights
      : [
          "Audit weekly timetable coverage",
          "Monitor daily attendance signals",
          "Review open conduct cases",
          "Coordinate staff notices",
        ];

  const areaStats: Record<string, string> = {
    classes: `${formatSchoolStatValue(classes, { loading: summaryLoading })} streams`,
    teachers: `${formatSchoolStatValue(teachers, { loading: summaryLoading })} teachers`,
    absent: `${formatSchoolStatValue(absent, { loading: summaryLoading })} unexcused (7d)`,
    students: `${formatSchoolStatValue(students, { loading: summaryLoading })} learners`,
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
    <div className="space-y-6 p-4 pb-12 md:p-6">
      <AdminPageHero
        eyebrow="Academic Quality & Standards Desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Direct supervision of curriculum delivery, lesson timetables, student conduct, and teacher standards for ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/timetable/classes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <CalendarClock className="h-4 w-4 text-sky-600" />
              Review Timetables
            </Link>
            <Link
              href="/app/discipline-admin"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Shield className="h-4 w-4 text-amber-300" />
              Conduct Records
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

      {/* Domain Section 1: Academic Quality & Curriculum Delivery */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700">
              Curriculum & Coverage
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Academic Quality Oversight
            </h2>
          </div>
          <Link
            href="/app/admin/timetable/classes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:text-sky-800"
          >
            Open timetable suite
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUALITY_MODULES.map((mod) => {
            const Icon = mod.icon;
            const stat = mod.statKey ? areaStats[mod.statKey] : null;

            return (
              <Link
                key={mod.href + mod.title}
                href={mod.href}
                className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
              >
                <div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200/80">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                    {mod.title}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {mod.description}
                  </p>
                </div>
                {stat ? (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <span className="text-xs font-bold tabular-nums text-slate-700">
                      {stat}
                    </span>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Domain Section 2: Standards, Discipline & Class Allocation */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">
                School Standards
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Conduct & Discipline Governance
              </h2>
            </div>
            <Link
              href="/app/discipline-admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
            >
              Conduct desk <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {STANDARDS_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {mod.badge}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-slate-900 group-hover:text-slate-800">
                      {mod.title}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      {mod.description}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-slate-600">
                    <span>Manage records</span>
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Domain Section 3: Staff Liaison & Communications */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                Coordination
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Staff & Community Liaison
              </h2>
            </div>
            <Link
              href="/app/messages"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              Open Inbox <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {COMMS_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 transition hover:border-slate-300 hover:bg-white"
                >
                  <div>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-2.5 font-semibold text-slate-900 text-xs sm:text-sm">
                      {mod.title}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      {mod.description}
                    </p>
                  </div>
                  <div className="mt-3 text-right">
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 transition" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Standards & Oversight Protocol Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          Deputy Head Quality Protocol
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Essential supervisory checkpoints for maintaining Zambian educational standards:
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUALITY_WORKFLOW.map((step, index) => (
            <div
              key={step}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 text-xs text-slate-700"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              <p className="leading-relaxed">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
