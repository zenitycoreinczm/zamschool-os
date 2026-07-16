"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import { ModuleCard } from "@/components/workspace/ModuleCard";
import { SectionIntro } from "@/components/workspace/SectionIntro";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
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

const PRIMARY_ACTIONS = [
  {
    title: "Register a student",
    description: "Add a learner with class number and class.",
    href: "/app/registrar/people",
  },
  {
    title: "Register a parent",
    description: "Create guardian accounts and contact details.",
    href: "/app/registrar/people",
  },
  {
    title: "Classes & placement",
    description: "Create classes, enrol students, assign class teachers.",
    href: "/app/registrar/classes",
  },
  {
    title: "Link families",
    description: "Connect parents to children on the Parents tab.",
    href: "/app/registrar/people",
  },
] as const;

const SIMPLE_STEPS = [
  "Create or open a class under Classes.",
  "Register the student under People and assign their class number.",
  "Register the parent, then use Link students on that parent.",
  "Assign a class teacher from the class card when ready.",
];

export default function RegistrarDashboardHome() {
  const workspace = useWorkspaceData();
  const { metrics, highlights, loading } = useWorkspaceSummary();

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

      <section>
        <SectionIntro
          title="What you can do"
          description="Core admissions tasks - open one and start working."
        />
        <div className="grid gap-2.5 sm:grid-cols-2">
          {PRIMARY_ACTIONS.map((item) => (
            <ModuleCard
              key={item.title}
              title={item.title}
              description={item.description}
              href={item.href}
              tone="slate"
            />
          ))}
        </div>
      </section>

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
              className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="text-sm font-medium text-slate-800">
                People directory
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/app/registrar/classes"
              className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
            >
              <span className="text-sm font-medium text-slate-800">
                Classes & class teachers
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5" />
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
