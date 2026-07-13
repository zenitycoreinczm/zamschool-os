"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { FocusPills } from "@/components/workspace/FocusPills";
import { metricsToStatCards } from "@/components/workspace/metricIcons";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { formatKwacha } from "@/lib/zambia-localization";

export default function PaymentsDashboardHome() {
  const ctx = useWorkspaceContext() || {};
  const workspace = (ctx as any).data ?? null;
  const { metrics, highlights, loading: summaryLoading } = useWorkspaceSummary();
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    overduePayments: 0,
    totalStudents: 0,
  });
  const [recentPayments, setRecentPayments] = useState<Record<string, unknown>[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoadingPayments(true);
      try {
        const data = await adminApiJson<{
          total_collected?: number;
          total_outstanding?: number;
          overdue_count?: number;
          student_count?: number;
        }>("/api/payments/billing/summary");
        setStats({
          totalRevenue: data.total_collected || 0,
          pendingPayments: data.total_outstanding || 0,
          overduePayments: data.overdue_count || 0,
          totalStudents: data.student_count || 0,
        });
      } catch {
        // keep defaults
      }
      try {
        const data = await adminApiJson<{ data?: Record<string, unknown>[] }>("/api/admin/payments");
        setRecentPayments(Array.isArray(data?.data) ? data.data.slice(0, 8) : []);
      } catch {
        setRecentPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    };
    void load();
  }, []);

  const schoolName = workspace?.schoolName || "Your school";
  const heroStats =
    summaryLoading || metrics.length === 0
      ? [
          {
            label: "Collected",
            value: formatKwacha(stats.totalRevenue, { symbol: "K" }),
            tone: "emerald" as const,
          },
          {
            label: "Outstanding",
            value: formatKwacha(stats.pendingPayments, { symbol: "K" }),
            tone: "amber" as const,
          },
          { label: "Overdue", value: String(stats.overduePayments), tone: "sky" as const },
          { label: "Students", value: String(stats.totalStudents), tone: "violet" as const },
        ]
      : metricsToStatCards(metrics);

  return (
    <div className="space-y-4">
      <AdminPageHero
        eyebrow="Payments workspace"
        title={schoolName}
        description="Fee collection, student balances, and payment activity for your school."
        accent="slate"
        stats={heroStats}
        actions={
          <>
            <Link
              href="/app/payments/fees"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >

              Manage fees
            </Link>
            <Link
              href="/app/payments/students"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Student accounts
            </Link>
          </>
        }
      />

      <FocusPills items={highlights} accent="slate" />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent payments</h2>
          <Link href="/app/admin/finance" className="text-sm font-semibold text-sky-600 hover:text-sky-700">
            Full finance →
          </Link>
        </div>

        {loadingPayments ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : recentPayments.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No recent payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentPayments.map((payment, index) => {
              const student = payment.student as { first_name?: string; last_name?: string } | undefined;
              const name = [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student";
              const amount = Number(payment.amount || 0);
              const status = String(payment.status || "pending");
              return (
                <li
                  key={String(payment.id || index)}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span className="font-medium text-slate-800">{name}</span>
                  <span className="tabular-nums text-slate-700">
                    {formatKwacha(amount, { symbol: "K" })}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      status === "confirmed"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}