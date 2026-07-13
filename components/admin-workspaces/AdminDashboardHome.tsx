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

export default function AdminDashboardHome() {
  const workspaceCtx = useWorkspaceContext() ?? undefined;
  const workspace = workspaceCtx?.data ?? null;
  const summary = useWorkspaceSummary() ?? undefined;
  const metrics = summary?.metrics ?? [];
  const highlights = summary?.highlights ?? [];
  const loading = summary?.loading ?? true;

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "Academic context";
  const displayName = workspace?.displayName || "Administrator";

  const heroStats = schoolHeroStatsFromSummary(metrics, FALLBACK_LABELS, loading);

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHero
        eyebrow="School administrator workspace"
        title={schoolName}
        description={`Welcome back, ${displayName}. Operational overview for ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <Link
            href="/app/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          >
            Users & accounts
          </Link>
        }
      />

      <FocusPills items={highlights} />

      <SchoolAdminDashboard />
    </div>
  );
}
