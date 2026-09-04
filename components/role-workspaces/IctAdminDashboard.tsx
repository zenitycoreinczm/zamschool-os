"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Loader2,
  MessageSquare,
  RefreshCw,
  ScrollText,
  UserCog,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { SchoolBackupCard } from "@/components/admin/SchoolBackupCard";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import { schoolHeroStatsFromSummary } from "@/lib/workspace/metric-display";

const FOCUS_AREAS = [
  "Account recovery",
  "Authenticator (2FA) reset",
  "Security audit",
  "School profile",
];

const WORKFLOW = [
  "Open User recovery when a student, teacher, or parent loses their authenticator app.",
  "Open the user → Disable authenticator (2FA) so they can sign in with email and password only.",
  "Ask them to re-enable two-factor authentication in Settings after they get back in.",
  "Review the audit trail for unusual access and keep the school profile current.",
];

// Monochrome slate icon tiles - same pattern as the registrar/academic
// desks. One accent: the icon inverts to slate-900 on hover.
const MODULES = [
  {
    href: "/app/ict-admin/recovery",
    title: "User recovery",
    description:
      "Password resets and disable authenticator (2FA) for locked-out users.",
    icon: UserCog,
  },
  {
    href: "/app/admin/audit",
    title: "Audit trail",
    description: "Security-sensitive actions and changes.",
    icon: ScrollText,
  },
  {
    href: "/app/admin/school",
    title: "School profile",
    description: "Identity, branding, and platform settings.",
    icon: Building2,
  },
  {
    href: "/app/messages",
    title: "Messages",
    description: "Coordinate with leadership and staff.",
    icon: MessageSquare,
  },
] as const;

export default function IctAdminDashboard() {
  const workspace = useWorkspaceData();
  const {
    metrics,
    highlights,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useWorkspaceSummary();
  const [refreshing, setRefreshing] = useState(false);

  const schoolName = workspace?.schoolName || "Your school";
  const displayName = workspace?.displayName || "ICT administrator";
  const yearTerm = workspace?.yearTerm || "this term";

  const heroStats = schoolHeroStatsFromSummary(
    metrics,
    [
      { label: "Accounts", hint: "School profiles" },
      { label: "Audit (7d)", hint: "Security events" },
      { label: "Teachers", hint: "Teaching accounts" },
      { label: "Alerts", hint: "Unread notifications" },
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
        eyebrow="Technical desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Recover locked accounts, turn off authenticator (2FA) when someone loses their app, and keep the platform reliable for ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/ict-admin/recovery"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              <UserCog className="h-4 w-4 text-slate-700" />
              User recovery
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

      <SchoolBackupCard title="ICT school backup (PDF)" />

      <section aria-label="Support modules">
        <p className="ws-eyebrow text-slate-400">Modules</p>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
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
          Account recovery guide
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
