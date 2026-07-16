"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { getDisplayInitials } from "@/lib/display-initials";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { LogOut, Menu, MessageSquare, X } from "lucide-react";

import {
  TeacherWorkspaceProvider,
  useTeacherWorkspace,
} from "@/components/TeacherWorkspaceProvider";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { MobileDock } from "@/components/workspace/MobileDock";
import { useNavBadges } from "@/components/workspace/useNavBadges";
import { navItemsToWorkspacePages } from "@/lib/workspace/search";
import {
  buildTeacherPortalDock,
  flattenNavSections,
  teacherPortalSections,
} from "@/lib/workspace/nav";
import { formatNavBadgeCount } from "@/lib/workspace/nav-badges";

import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { useTeacherWorkspacePreferences } from "@/lib/teacher-workspace-preferences";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type ShellStatKey = "lessons" | "students" | "completed" | "pending";

const teacherNavItems = flattenNavSections(teacherPortalSections);
const teacherDock = buildTeacherPortalDock();

const statLabels: Record<ShellStatKey, string> = {
  lessons: "Lessons",
  students: "Students",
  completed: "Done",
  pending: "Pending",
};

const statLinks: Record<ShellStatKey, string> = {
  lessons: "/app/teacher/teaching",
  students: "/app/teacher/students",
  completed: "/app/teacher/attendance",
  pending: "/app/teacher/assignments",
};

export default function TeacherShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherWorkspaceProvider>
      <TeacherShellContent>{children}</TeacherShellContent>
    </TeacherWorkspaceProvider>
  );
}

function TeacherShellContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const {
    account,
    stats,
    workload,
    displayName,
    schoolName,
    yearTerm,
    loading: workspaceLoading,
    error: workspaceError,
  } = useTeacherWorkspace();
  const { preferences } = useTeacherWorkspacePreferences();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const teacher = account?.teacher;
  const avatarUrl = account?.profile?.avatar_url || null;
  const avatarInitials = getDisplayInitials({
    firstName:
      account?.profile?.first_name ||
      (account?.profile as { firstName?: string } | undefined)?.firstName,
    lastName:
      account?.profile?.last_name ||
      (account?.profile as { lastName?: string } | undefined)?.lastName,
    displayName,
    email: account?.profile?.email,
  });
  const compactCards = preferences.compactCards;
  const displayStats = {
    ...stats,
    pending: teacher?.pendingRollCalls ?? stats.pending,
  };
  const workspacePageItems = useMemo(
    () => navItemsToWorkspacePages(teacherNavItems),
    [],
  );
  const activePaths = useMemo(() => new Set([pathname]), [pathname]);
  const navHrefs = useMemo(
    () => [
      ...teacherNavItems.map((item) => item.href),
      ...teacherDock.map((item) => item.href),
    ],
    [],
  );
  const { counts: navBadgeCounts, badgeByHref } = useNavBadges({
    apiMode: "teacher",
    hrefs: navHrefs,
    // Teacher portal nav focuses on inbox; feed badges still load if present.
    trackFeedSections: true,
    initialMessages: workload.unreadMessages ?? 0,
    initialNotifications: workload.unreadNotifications ?? 0,
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

  return (
    <div className={cn("flex h-screen overflow-hidden", ws.canvas)}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-workspace-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-workspace-md"
      >
        Skip to content
      </a>
      {open ? (
        <button
          className={cn("fixed inset-0 z-30 lg:hidden", ws.overlay)}
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}

      <aside
        id="teacher-sidebar"
        role="navigation"
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[17.5rem] border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
            <Link
              href="/app/teacher"
              className="flex min-w-0 items-center gap-3"
            >
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
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Teacher
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

          {/* Desk identity - Name | focus summary */}
          <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Your desk
            </p>
            <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">
              <span>{displayName}</span>
              <span className="mx-1.5 font-normal text-slate-300">|</span>
              <span className="font-medium text-slate-600">
                {workspaceLoading
                  ? "…"
                  : `${displayStats.students} students`}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-[11px] text-slate-500">
              <AcademicContextLabel
                value={yearTerm}
                yearClassName="font-medium text-slate-600"
                termClassName="text-slate-400"
              />
              {!workspaceLoading ? (
                <span>· {displayStats.lessons} lessons today</span>
              ) : null}
            </p>
          </div>

          {/* Compact mono-tone stats */}
          <div className="border-b border-slate-200/80 px-3 py-3">
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(stats) as ShellStatKey[]).map((key) => (
                <Link
                  key={key}
                  href={statLinks[key]}
                  className="rounded-xl border border-slate-200/80 bg-white px-2.5 py-2 text-center transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <p className="text-base font-semibold tabular-nums text-slate-900">
                    {workspaceLoading ? "…" : displayStats[key]}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {statLabels[key]}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <WorkspaceNavMenu
              sections={teacherPortalSections}
              activePaths={activePaths}
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
              aria-controls="teacher-sidebar"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                <AcademicContextLabel
                  value={yearTerm}
                  yearClassName="font-medium text-slate-600"
                  termClassName="text-slate-400"
                />
              </p>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-slate-900">
                <AcademicContextLabel value={yearTerm} />
              </p>
              <p className="truncate text-xs text-slate-500">
                {displayName} · Teacher
              </p>
            </div>
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder="Search students, classes…"
            className="hidden min-w-0 flex-1 sm:block sm:max-w-[320px]"
          />

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/app/teacher/inbox"
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
              href="/app/teacher/profile"
              className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-slate-300 bg-slate-800 text-sm font-semibold text-white shadow-sm"
              aria-label="Open profile"
            >
              {avatarUrl ? (
                <ProfileAvatarImage
                  src={avatarUrl}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  fallback={avatarInitials}
                />
              ) : (
                avatarInitials
              )}
            </Link>
          </div>
        </header>

        {workspaceError ? (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6"
          >
            {workspaceError}
          </div>
        ) : null}

        <main id="main" className={cn(ws.mainScroll, "flex-1")}>
          <div
            className={cn(
              "relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6",
              compactCards && "max-w-[88rem]",
            )}
          >
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={teacherDock}
          onClose={() => setOpen(false)}
          activeAccent="slate"
          columns={5}
          badgeByHref={badgeByHref}
        />
      </div>
    </div>
  );
}
