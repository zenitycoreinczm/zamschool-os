"use client";

import Link from "next/link";
import Image from "next/image";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { getDisplayInitials } from "@/lib/display-initials";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { adminApiJson } from "@/lib/admin-browser-api";
import { WorkspaceInboxCenter } from "@/components/inbox/WorkspaceInboxCenter";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { MobileDock } from "@/components/workspace/MobileDock";
import { useNavBadges } from "@/components/workspace/useNavBadges";
import { navItemsToWorkspacePages } from "@/lib/workspace/search";
import {
  buildRoleMobileDock,
  flattenNavSections,
  paymentsSections,
} from "@/lib/workspace/nav";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { formatKwacha } from "@/lib/zambia-localization";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";
import {
  Bell,
  CreditCard,
  FileBarChart2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";

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
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
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
  const workspacePageItems = useMemo(
    () => navItemsToWorkspacePages(paymentsNavItems),
    [],
  );
  const mobileDock = useMemo(() => buildRoleMobileDock("payments"), []);
  const navHrefs = useMemo(
    () => [
      ...paymentsNavItems.map((item) => item.href),
      ...mobileDock.map((item) => item.href),
    ],
    [mobileDock],
  );
  const { counts: navBadgeCounts, badgeByHref } = useNavBadges({
    apiMode: "admin",
    hrefs: navHrefs,
    trackFeedSections: true,
  });
  const unreadSummary = {
    messages: navBadgeCounts.messages,
    notifications: navBadgeCounts.notifications,
  };

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

  const activeSet = useMemo(() => new Set([pathname]), [pathname]);

  const logout = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await performWorkspaceSignOut(supabase);
  };

  if (signingOut) {
    return (
      <WorkspaceLoader label="Signing out…" className="fixed inset-0 z-[200]" />
    );
  }

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
    <div className={cn("zamschool-workspace-shell", ws.canvas)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-workspace-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-workspace-md"
      >
        Skip to content
      </a>
      {open && (
        <button
          className={cn("fixed inset-0 z-30 lg:hidden", ws.overlay)}
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <aside
        role="navigation"
        aria-label="Primary"
        className={`zamschool-workspace-shell__sidebar transition-transform duration-250 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="px-4 py-5 border-b border-slate-200/80 flex items-center justify-between">
            <Link href="/app/payments" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm bg-white">
                <Image
                  src="/icon.png"
                  alt="ZamSchool OS"
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
              <div>
                <p className="font-semibold text-slate-900 leading-tight">
                  ZamSchool OS
                </p>
                <p className="text-xs text-slate-500 leading-tight">
                  Payments Office
                </p>
              </div>
            </Link>
            <button
              className="lg:hidden p-2 text-slate-500"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Payments Stats */}
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
                  <p
                    className={cn(
                      "text-sm font-semibold ws-tabular",
                      tile.tone,
                    )}
                  >
                    {tile.value}
                  </p>
                  <p className="text-[11px] text-workspace-muted">
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <WorkspaceNavMenu
              sections={paymentsSections}
              activePaths={activeSet}
              onNavigate={() => setOpen(false)}
              badgeByHref={badgeByHref}
            />
          </div>

          <div className="p-3 border-t border-slate-200/80">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="zamschool-workspace-shell__main">
        <header
          className={cn(
            ws.header,
            "flex items-center justify-between gap-4 border-b border-workspace-border/60 px-4 py-3.5 md:px-6",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 -ml-2 text-slate-600"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="payments-sidebar"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:block min-w-0">
              <p className="font-semibold text-slate-900 truncate">
                {schoolName}
              </p>
              <p className="truncate text-xs text-slate-500">
                <AcademicContextLabel
                  value={yearTerm}
                  yearClassName="font-medium text-slate-600"
                  termClassName="text-slate-400"
                />
              </p>
            </div>
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder="Search students, fees, pages…"
            className="hidden min-w-0 flex-1 sm:block sm:max-w-[360px]"
          />

          <div className="flex items-center gap-3">
            <WorkspaceInboxCenter
              apiMode="admin"
              messagesHref="/app/messages"
              notificationsHref="/app/notifications"
              initialUnread={unreadSummary}
            />
            <div className="hidden sm:flex items-center gap-3 pl-2">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400">Payments Officer</p>
              </div>
              <Link
                href="/app/profile"
                className="group relative w-10 h-10 rounded-full overflow-hidden border border-green-200 bg-green-500 text-white grid place-items-center text-sm font-semibold shadow-sm transition-all hover:ring-2 hover:ring-green-100 focus-visible:ring-2 focus-visible:ring-green-100"
              >
                {(() => {
                  const initials = getDisplayInitials({
                    firstName: workspace?.firstName,
                    lastName: workspace?.lastName,
                    displayName,
                    email: workspace?.email,
                  });
                  return avatarUrl ? (
                    <ProfileAvatarImage
                      src={avatarUrl}
                      alt={displayName}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                      fallback={initials}
                    />
                  ) : (
                    initials
                  );
                })()}
              </Link>
            </div>
          </div>
        </header>

        <main id="main" className={ws.mainScroll}>
          <div className="relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6">
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={mobileDock}
          onClose={() => setOpen(false)}
          activeAccent="neutral"
          columns={5}
          badgeByHref={badgeByHref}
        />
      </div>
    </div>
  );
}
