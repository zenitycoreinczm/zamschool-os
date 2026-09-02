"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import {
  buildRoleMobileDock,
  flattenNavSections,
  paymentsSections,
} from "@/lib/workspace/nav";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import WorkspaceShell, {
  workspaceShellInitials,
} from "@/components/workspace/WorkspaceShell";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";
import { ws } from "@/lib/workspace/design";
import { formatKwacha } from "@/lib/zambia-localization";

const paymentsNavItems = flattenNavSections(paymentsSections);

export default function PaymentsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceCtx = useWorkspaceContext();
  const workspace = workspaceCtx?.data ?? null;
  const workspaceLoading = workspaceCtx?.loading ?? true;
  const workspaceError = workspaceCtx?.error ?? "";
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingPayments: 0,
    overduePayments: 0,
    totalStudents: 0,
  });

  const ready = !workspaceLoading && Boolean(workspace);
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Your Account";
  const avatarUrl = workspace?.avatarUrl || null;
  const mobileDock = useMemo(() => buildRoleMobileDock("payments"), []);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    const role = workspace.workspaceRole;
    if (role !== "payments" && role !== "bursar") {
      router.replace("/login?error=payments_access_required");
      return;
    }

    if (!workspace.emailConfirmed) {
      router.replace("/verify-email");
    }
  }, [workspace, router]);

  useEffect(() => {
    if (!workspace?.schoolId) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      try {
        const payload = await adminApiJson<{
          data?: {
            totalRevenue?: number;
            pendingPayments?: number;
            overduePayments?: number;
            totalStudents?: number;
          };
        }>("/api/payments/shell-summary");

        if (cancelled) {
          return;
        }

        setStats({
          totalRevenue: Number(payload?.data?.totalRevenue || 0),
          pendingPayments: Number(payload?.data?.pendingPayments || 0),
          overduePayments: Number(payload?.data?.overduePayments || 0),
          totalStudents: Number(payload?.data?.totalStudents || 0),
        });
      } catch (error) {
        console.error("Error loading payments stats:", error);
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [workspace?.schoolId]);

  if (workspaceError && !workspaceLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
        <div role="alert" className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-lg">
          <h2 className="text-lg font-bold text-rose-700">Payments Workspace Access Error</h2>
          <p className="mt-2 text-sm text-slate-600">{workspaceError}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <WorkspaceLoader
        label="Loading payments workspace"
        hint="Syncing fees and school access"
      />
    );
  }

  return (
    <WorkspaceShell
      pathname={pathname}
      displayName={displayName}
      avatarUrl={avatarUrl}
      avatarInitials={workspaceShellInitials({
        firstName: workspace?.firstName,
        lastName: workspace?.lastName,
        displayName,
        email: workspace?.email,
      })}
      rootClassName="zamschool-workspace-shell"
      sidebarClassName="zamschool-workspace-shell__sidebar transition-transform duration-250"
      mainShellClassName="zamschool-workspace-shell__main"
      mainClassName={ws.mainScroll}
      sidebarId="payments-sidebar"
      homeHref="/app/payments"
      brandTitle="ZamSchool OS"
      brandSubtitle="Payments Office"
      extraSidebarBand={
        /* Payments Stats */
        <div className="border-b border-workspace-border px-3 py-4">
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "Revenue",
                value: formatKwacha(stats.totalRevenue, { symbol: "K" }),
                tone: "text-emerald-700",
              },
              {
                label: "Pending",
                value: formatKwacha(stats.pendingPayments, { symbol: "K" }),
                tone: "text-amber-700",
              },
              {
                label: "Students",
                value: String(stats.totalStudents),
                tone: "text-slate-800",
              },
              {
                label: "Overdue",
                value: String(stats.overduePayments),
                tone: "text-rose-700",
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-workspace-lg border border-workspace-border bg-white p-3 text-center shadow-workspace-xs"
              >
                <p className="text-sm font-semibold ws-tabular">{tile.value}</p>
                <p className="text-[11px] text-workspace-muted">{tile.label}</p>
              </div>
            ))}
          </div>
        </div>
      }
      navSections={paymentsSections}
      navItems={paymentsNavItems}
      dock={mobileDock}
      dockAccent="neutral"
      inboxApiMode="admin"
      searchPlaceholder="Search students, fees, pages…"
      searchMaxWidthClassName="sm:max-w-[360px]"
      messagesHref="/app/messages"
      notificationsHref="/app/notifications"
      profileHref="/app/profile"
      profileChipClassName="border-green-200 bg-green-500 text-white"
      profileAside={
        <div className="hidden items-center gap-3 pl-2 sm:flex">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-slate-800">{displayName}</p>
            <p className="text-[11px] text-slate-400">Payments Officer</p>
          </div>
        </div>
      }
      headerMobileIdentity={null}
      headerDesktopIdentity={
        <>
          <p className="truncate font-semibold text-slate-900">{schoolName}</p>
          <p className="truncate text-xs text-slate-500">
            <AcademicContextLabel
              value={yearTerm}
              yearClassName="font-medium text-slate-600"
              termClassName="text-slate-400"
            />
          </p>
        </>
      }
    >
      {children}
    </WorkspaceShell>
  );
}
