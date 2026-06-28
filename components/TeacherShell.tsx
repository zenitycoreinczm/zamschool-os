"use client";

import Image from "next/image";
import Link from "next/link";
import { getDisplayInitials } from "@/lib/display-initials";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LogOut, X } from "lucide-react";

import {
  TeacherWorkspaceProvider,
  useTeacherWorkspace,
} from "@/components/TeacherWorkspaceProvider";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceShellHeader } from "@/components/workspace/WorkspaceShellHeader";
import { MobileDock } from "@/components/workspace/MobileDock";
import { navItemsToWorkspacePages } from "@/lib/workspace/search";
import {
  buildTeacherPortalDock,
  flattenNavSections,
  teacherPortalSections,
} from "@/lib/workspace/nav";

import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { useTeacherWorkspacePreferences } from "@/lib/teacher-workspace-preferences";

type ShellStatKey = "lessons" | "students" | "completed" | "pending";

const teacherNavItems = flattenNavSections(teacherPortalSections);
const teacherDock = buildTeacherPortalDock();

const statLabels: Record<ShellStatKey, string> = {
  lessons: "Lessons",
  students: "Students",
  completed: "Complete",
  pending: "Pending",
};

const statLinks: Record<ShellStatKey, string> = {
  lessons: "/teacher/classes?view=queue",
  students: "/teacher/students",
  completed: "/teacher/attendance?filter=completed",
  pending: "/teacher/classes?filter=pending",
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
  const router = useRouter();
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
    firstName: account?.profile?.first_name || (account?.profile as any)?.firstName,
    lastName: account?.profile?.last_name || (account?.profile as any)?.lastName,
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
          "fixed inset-y-0 left-0 z-40 border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          compactCards ? "w-60" : "w-64",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={`flex items-center justify-between border-b border-slate-200/80 px-4 ${compactCards ? "py-4" : "py-5"}`}
          >
            <Link href="/app/teacher" className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-white shadow-sm">
                <Image
                  src="/icon.png"
                  alt="ZamSchool OS"
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div>
                <p className="font-semibold text-slate-900 leading-tight">
                  ZamSchool OS
                </p>
                <p className="text-xs text-slate-500 leading-tight">
                  Teacher Workspace
                </p>
              </div>
            </Link>
            <button
              className="p-2 text-slate-500 lg:hidden"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className={`border-b border-slate-200/80 px-3 ${compactCards ? "py-3" : "py-4"}`}
          >
            <div
              className={`grid grid-cols-2 ${compactCards ? "gap-1.5" : "gap-2"}`}
            >
              {(Object.keys(stats) as ShellStatKey[]).map((key) => (
                <Link
                  key={key}
                  href={statLinks[key]}
                  className={`rounded-lg bg-white text-center transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${
                    compactCards ? "p-2.5" : "p-3"
                  }`}
                >
                  <p
                    className={`${compactCards ? "text-base" : "text-lg"} font-semibold text-slate-800`}
                  >
                    {workspaceLoading ? "..." : displayStats[key]}
                  </p>
                  <p
                    className={`${compactCards ? "text-[11px]" : "text-xs"} text-slate-500`}
                  >
                    {statLabels[key]}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div
            className={`flex-1 overflow-y-auto px-3 ${compactCards ? "py-4" : "py-5"}`}
          >
            <WorkspaceNavMenu
              sections={teacherPortalSections}
              activePaths={activePaths}
              onNavigate={() => setOpen(false)}
            />
          </div>

          <div className="border-t border-slate-200/80 p-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-white hover:text-red-600"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="zamschool-workspace-shell__main flex min-w-0 flex-1 flex-col">
        <WorkspaceShellHeader
          sidebarId="teacher-sidebar"
          sidebarOpen={open}
          onOpenSidebar={() => setOpen(true)}
          schoolName={schoolName}
          yearTerm={yearTerm}
          pageItems={workspacePageItems}
          searchPlaceholder="Search students, classes, pages…"
          displayName={displayName}
          workspaceLabel="Teacher Workspace"
          avatarUrl={avatarUrl}
          avatarInitials={avatarInitials}
          profileHref="/app/teacher/profile"
          settingsHref="/app/teacher/settings"
          apiMode="teacher"
          messagesHref="/app/teacher/inbox"
          notificationsHref="/app/teacher/notifications"
          initialUnread={{
            messages: workload.unreadMessages,
            notifications: workload.unreadNotifications,
          }}
          onSignOut={logout}
        />

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
          activeAccent="sky"
          columns={5}
        />
      </div>
    </div>
  );
}
