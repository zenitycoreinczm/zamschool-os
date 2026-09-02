"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

import {
  TeacherWorkspaceProvider,
  useTeacherWorkspace,
} from "@/components/TeacherWorkspaceProvider";
import {
  buildTeacherPortalDock,
  flattenNavSections,
  teacherPortalSections,
} from "@/lib/workspace/nav";
import WorkspaceShell, {
  WorkspaceShellDeskBand,
  workspaceShellInitials,
} from "@/components/workspace/WorkspaceShell";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";
import { useTeacherWorkspacePreferences } from "@/lib/teacher-workspace-preferences";

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
  const teacher = account?.teacher;
  const avatarUrl = account?.profile?.avatar_url || null;
  const compactCards = preferences.compactCards;
  const displayStats = {
    ...stats,
    pending: teacher?.pendingRollCalls ?? stats.pending,
  };

  return (
    <WorkspaceShell
      pathname={pathname}
      displayName={displayName}
      avatarUrl={avatarUrl}
      avatarInitials={workspaceShellInitials({
        firstName:
          account?.profile?.first_name ||
          (account?.profile as { firstName?: string } | undefined)?.firstName,
        lastName:
          account?.profile?.last_name ||
          (account?.profile as { lastName?: string } | undefined)?.lastName,
        displayName,
        email: account?.profile?.email,
      })}
      sidebarId="teacher-sidebar"
      homeHref="/app/teacher"
      brandTitle={schoolName}
      brandSubtitle="Teacher"
      deskBand={
        <WorkspaceShellDeskBand label="Your desk">
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
        </WorkspaceShellDeskBand>
      }
      extraSidebarBand={
        /* Compact mono-tone stats */
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
      }
      navSections={teacherPortalSections}
      navItems={teacherNavItems}
      dock={teacherDock}
      inboxApiMode="teacher"
      badgeInitialMessages={workload.unreadMessages ?? 0}
      badgeInitialNotifications={workload.unreadNotifications ?? 0}
      searchPlaceholder="Search students, classes…"
      messagesHref="/app/teacher/inbox"
      notificationsHref="/app/teacher/notifications"
      profileHref="/app/teacher/profile"
      profileChipClassName="border-slate-300 bg-slate-800 text-white"
      headerSubtitle="Teacher"
      headerMobileSubtitle={
        <AcademicContextLabel
          value={yearTerm}
          yearClassName="font-medium text-slate-600"
          termClassName="text-slate-400"
        />
      }
      yearTerm={yearTerm}
      errorBanner={workspaceError}
      mainInnerClassName={compactCards ? "max-w-[88rem]" : undefined}
    >
      {children}
    </WorkspaceShell>
  );
}
