"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import RoleSetupGuide, {
  persistGuideDismissed,
  readGuideDismissed,
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

const DEFAULT_FOCUS = [
  "Register students",
  "Link parents & guardians",
  "Place learners in classes",
  "Keep records up to date",
];

const SIMPLE_STEPS = [
  "Create or open a class under Classes.",
  "Register the student under People and assign their class number.",
  "Register the parent, then use Link students on that parent.",
  "Assign a class teacher from the class card when ready.",
];

export default function RegistrarDashboardHome() {
  const workspace = useWorkspaceData();
  const { metrics, highlights, loading } = useWorkspaceSummary();
  const [guideDismissed, setGuideDismissed] = useState(true);

  useEffect(() => {
    setGuideDismissed(
      readGuideDismissed("zamschool.guide.registrar.dismissed"),
    );
  }, []);

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "the current term";
  const displayName = workspace?.displayName || "Registrar";

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    FALLBACK_LABELS,
    loading,
    { tone: "slate" },
  );

  const focusItems = highlights.length > 0 ? highlights : DEFAULT_FOCUS;

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
        description={`Welcome back, ${displayName}. Enrolment for ${yearTerm} - register people, place learners, and keep family links current.`}
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

      <FocusPills items={focusItems} accent="slate" />

      {showGuide ? (
        <RoleSetupGuide
          guide={guide}
          onDismiss={() => {
            persistGuideDismissed(guide.storageKey);
            setGuideDismissed(true);
          }}
        />
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Simple workflow
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Four steps for a clean enrolment.
          </p>
          <ol className="mt-4 space-y-3">
            {SIMPLE_STEPS.map((step, index) => (
              <li
                key={step}
                className="flex items-start gap-3 text-sm text-slate-600"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600 ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Open directories
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Jump to the lists you use every day.
          </p>
          <div className="mt-4 space-y-2">
            <Link
              href="/app/registrar/people"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Student directory
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Full learner profiles, admissions records, and guardian links.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/registrar/people?bulk=1"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Bulk learner / teacher import
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  CSV bulk upload on People — students, teachers, or parents.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/registrar/classes"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Class placements
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Assign learners to classes, streams, and academic groups.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/admin/attendance"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Attendance & enrolment
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Enrolment status and early-term attendance overview.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/registrar/people"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Documents & records
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Learner biodata, birth certificates, and document tracking.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/messages"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Messages
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Communicate admissions updates to parents and staff.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/notifications"
              className="group flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800">
                  Notifications
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  Admission approvals, transfer alerts, and enrolment events.
                </span>
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <p className="pt-1 text-[11px] text-slate-400">
              Tip: class numbers (e.g. 45) make roll call and results clearer.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
