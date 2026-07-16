"use client";

import Link from "next/link";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { schoolHeroStatsFromSummary } from "@/lib/workspace/metric-display";

const FALLBACK_LABELS = [
  { label: "Students", hint: "On directory" },
  { label: "Teachers", hint: "Teaching accounts" },
  { label: "Attendance", hint: "Present rate" },
  { label: "Outstanding", hint: "Unpaid balances" },
];

/**
 * Legacy `/app/dashboard` home. School Administrator was collapsed into
 * Head Teacher - this surface no longer links to the Users directory.
 * Prefer `/app/principal` (shell redirects admin/principal here).
 */
export default function AdminDashboardHome() {
  const workspaceCtx = useWorkspaceContext() ?? undefined;
  const workspace = workspaceCtx?.data ?? null;
  const summary = useWorkspaceSummary() ?? undefined;
  const metrics = summary?.metrics ?? [];
  const highlights = summary?.highlights ?? [];
  const loading = summary?.loading ?? true;

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "Academic context";
  const displayName = workspace?.displayName || "Head Teacher";

  const heroStats = schoolHeroStatsFromSummary(metrics, FALLBACK_LABELS, loading);

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHero
        eyebrow="Head Teacher overview"
        title={schoolName}
        description={`Welcome back, ${displayName}. Leadership snapshot for ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <Link
            href="/app/principal/staff"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Invite staff
          </Link>
        }
      />

      <FocusPills items={highlights} />

      <SchoolAdminDashboard peopleMode="principal" />
    </div>
  );
}
