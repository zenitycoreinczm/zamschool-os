"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { getDisplayInitials } from "@/lib/display-initials";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu, MessageSquare, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { fetchShell } from "@/lib/shell-client";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { MobileDock } from "@/components/workspace/MobileDock";
import { useNavBadges } from "@/components/workspace/useNavBadges";
import { navItemsToWorkspacePages } from "@/lib/workspace/search";
import {
  buildStudentPortalDock,
  flattenNavSections,
  studentPortalSections,
} from "@/lib/workspace/nav";
import { formatNavBadgeCount } from "@/lib/workspace/nav-badges";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { formatStudentIdentityLine } from "@/lib/student-identity";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

const studentNavItems = flattenNavSections(studentPortalSections);
const studentDock = buildStudentPortalDock();

type StudentShellExtras = {
  className?: string | null;
  classNumber?: number | null;
  admissionNumber?: string | null;
  gradeLabel?: string | null;
};

export default function StudentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceCtx = useWorkspaceContext();
  const workspace = workspaceCtx?.data ?? null;
  const role = workspaceCtx?.role ?? null;
  const loading = workspaceCtx?.loading ?? true;
  const error = workspaceCtx?.error ?? "";
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [shellExtras, setShellExtras] = useState<StudentShellExtras>({});
  const workspacePageItems = useMemo(
    () => navItemsToWorkspacePages(studentNavItems),
    [],
  );

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (role !== "student") {
      router.replace("/login?error=student_access_required");
      return;
    }

    if (!workspace.emailConfirmed) {
      router.replace("/verify-email");
    }
  }, [workspace, role, router]);

  useEffect(() => {
    if (role !== "student") return;
    let cancelled = false;

    fetchShell()
      .then((shell) => {
        if (cancelled) return;
        const extras = (shell.shell || {}) as StudentShellExtras;
        setShellExtras({
          className: extras.className ?? null,
          classNumber:
            typeof extras.classNumber === "number" ? extras.classNumber : null,
          admissionNumber: extras.admissionNumber ?? null,
          gradeLabel: extras.gradeLabel ?? null,
        });
      })
      .catch(() => {
        // Non-critical shell extras.
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  const ready = !loading && Boolean(workspace) && role === "student";
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Student";
  const avatarUrl = workspace?.avatarUrl || null;
  const classNumber =
    shellExtras.classNumber ??
    (shellExtras.admissionNumber && /^\d+$/.test(shellExtras.admissionNumber)
      ? Number(shellExtras.admissionNumber)
      : null);
  const identityLine = formatStudentIdentityLine({
    displayName,
    className: shellExtras.className,
    classNumber,
  });
  const activeSet = useMemo(() => new Set([pathname]), [pathname]);
  const navHrefs = useMemo(
    () => [
      ...studentNavItems.map((item) => item.href),
      ...studentDock.map((item) => item.href),
    ],
    [],
  );
  const { counts: navBadgeCounts, badgeByHref } = useNavBadges({
    apiMode: "account",
    hrefs: navHrefs,
    trackFeedSections: true,
  });
  const unreadMessages = navBadgeCounts.messages;

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

  if (!ready) {
    return (
      <WorkspaceLoader
        label="Loading student portal"
        hint="Syncing your classes and account"
      />
    );
  }

  return (
    <div className={cn("flex h-screen overflow-hidden", ws.canvas)}>
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
        id="student-sidebar"
        role="navigation"
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[17.5rem] border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
            <Link href="/app/student" className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80">
                <Image
                  src="/icon.png"
                  alt="ZamSchool OS"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                  {schoolName}
                </p>
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-teal-700/80">
                  Student portal
                </p>
              </div>
            </Link>
            <button
              className="p-2 text-slate-500 lg:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Name | Class | Number - primary desk identity */}
          <div className="border-b border-slate-200/80 bg-gradient-to-br from-teal-50/90 via-white to-sky-50/60 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-800/70">
              Your desk
            </p>
            <p
              className="mt-1.5 text-[13px] font-semibold leading-snug tracking-tight text-slate-900"
              title={identityLine}
            >
              <span className="text-slate-900">{displayName}</span>
              <span className="mx-1.5 font-normal text-slate-300">|</span>
              <span className="text-teal-800">
                {shellExtras.className?.trim() || "No class"}
              </span>
              <span className="mx-1.5 font-normal text-slate-300">|</span>
              <span className="tabular-nums text-sky-800">
                {classNumber != null ? classNumber : "-"}
              </span>
            </p>
            {shellExtras.gradeLabel ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {shellExtras.gradeLabel}
              </p>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <WorkspaceNavMenu
              sections={studentPortalSections}
              activePaths={activeSet}
              onNavigate={() => setOpen(false)}
              accent="slate"
              badgeByHref={badgeByHref}
            />
          </div>

          <div className="border-t border-slate-200/80 p-3">
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-white hover:text-red-600"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span className="font-medium">Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="zamschool-workspace-shell__main flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            ws.header,
            "flex items-center justify-between gap-3 border-b border-workspace-border/60 px-4 py-3 md:px-6",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="-ml-2 p-2 text-slate-600 lg:hidden"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="student-sidebar"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {shellExtras.className || "Class pending"}
                {classNumber != null ? ` · #${classNumber}` : ""}
              </p>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-slate-900">
                <AcademicContextLabel value={yearTerm} />
              </p>
              <p className="truncate text-xs text-slate-500">
                {identityLine}
              </p>
            </div>
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder="Search assignments, pages…"
            className="hidden min-w-0 flex-1 sm:block sm:max-w-[320px]"
          />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/app/student/messages"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
              aria-label={
                unreadMessages > 0
                  ? `Messages, ${unreadMessages} unread`
                  : "Messages"
              }
            >
              <MessageSquare className="h-4.5 w-4.5" />
              {unreadMessages > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-slate-900 px-1 text-[10px] font-bold text-white">
                  {formatNavBadgeCount(unreadMessages) ||
                    (unreadMessages > 9 ? "9+" : String(unreadMessages))}
                </span>
              ) : null}
            </Link>
            <Link
              href="/app/student/profile"
              className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-800 shadow-sm"
              aria-label="Open profile"
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
        </header>

        {error ? (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6"
          >
            {error}
          </div>
        ) : null}

        <main id="main" className={cn(ws.mainScroll, "flex-1")}>
          <div className="relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6">
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={studentDock}
          onClose={() => setOpen(false)}
          activeAccent="slate"
          columns={4}
          badgeByHref={badgeByHref}
        />
      </div>
    </div>
  );
}
