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
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import { FocusPills } from "@/components/workspace/FocusPills";
import { SectionIntro } from "@/components/workspace/SectionIntro";
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
    description: "Fix weekly schedules, swap rooms and times, keep period coverage complete.",
    icon: GraduationCap,
    statKey: "classes" as const,
  },
  {
    href: "/app/admin/timetable/teachers",
    title: "Teacher Schedules",
    description: "Assign substitute cover, resolve clashes, and balance teaching workload.",
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
    description: "Behaviour cases and actions.",
    icon: Shield,
    badge: "Disciplinary authority",
  },
  {
    href: "/app/admin/classes",
    title: "Classes & Streams",
    description: "Streams, enrolments, supervisors.",
    icon: Users,
    badge: "Enrollment oversight",
  },
] as const;

const COMMS_MODULES = [
  {
    href: "/app/messages",
    title: "Staff Messages",
    description: "Coordinate with staff and leadership.",
    icon: MessageSquare,
  },
  {
    href: "/app/announcements",
    title: "School Notices",
    description: "Broadcast to staff and parents.",
    icon: Megaphone,
  },
  {
    href: "/app/events",
    title: "School Events",
    description: "Assemblies, exams, open days.",
    icon: Calendar,
  },
] as const;

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
          "Fix timetable clashes & arrange cover",
          "Monitor daily attendance signals",
          "Handle open conduct cases",
          "Coordinate events & staff notices",
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
        eyebrow="Daily operations desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Run the school day: attendance signals, discipline cases, timetable fixes, and staff coordination for ${yearTerm}. Final approvals stay with the Head Teacher.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/timetable/classes"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <CalendarClock className="h-4 w-4 text-sky-600" />
              Timetable fixes
            </Link>
            <Link
              href="/app/discipline-admin"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Shield className="h-4 w-4 text-slate-300" />
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

      <section>
        <SectionIntro
          title="School pulse"
          description="Live counts, attendance, finance, calendar, and announcements."
        />
        <SchoolAdminDashboard peopleMode="principal" />
      </section>

      <FocusPills items={focusItems} accent="slate" />

      {/* Domain Section 1: Academic Quality & Curriculum Delivery */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
              Curriculum & Coverage
            </p>
            <h2 className="text-lg font-bold text-slate-900">
              Academic Quality Oversight
            </h2>
          </div>
          <Link
            href="/app/admin/timetable/classes"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="mt-3 font-semibold text-slate-900 transition-colors">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                School Standards
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Conduct & Discipline Governance
              </h2>
            </div>
            <Link
              href="/app/discipline-admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {mod.badge}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Coordination
              </p>
              <h2 className="text-base font-bold text-slate-900">
                Staff & Community Liaison
              </h2>
            </div>
            <Link
              href="/app/messages"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
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
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
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
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 transition" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

    </div>
  );
}
