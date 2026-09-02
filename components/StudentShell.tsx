"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { fetchShell } from "@/lib/shell-client";
import {
  buildStudentPortalDock,
  flattenNavSections,
  studentPortalSections,
} from "@/lib/workspace/nav";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { formatStudentIdentityLine } from "@/lib/student-identity";
import WorkspaceShell, {
  WorkspaceShellDeskBand,
  workspaceShellInitials,
} from "@/components/workspace/WorkspaceShell";

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
  const [shellExtras, setShellExtras] = useState<StudentShellExtras>({});

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

  if (!ready) {
    return (
      <WorkspaceLoader
        label="Loading student portal"
        hint="Syncing your classes and account"
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
      sidebarId="student-sidebar"
      homeHref="/app/student"
      brandTitle={schoolName}
      brandSubtitle="Student portal"
      brandSubtitleClassName="text-teal-700/80"
      deskBand={
        <WorkspaceShellDeskBand label="Your desk" labelClassName="text-teal-800/70">
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
        </WorkspaceShellDeskBand>
      }
      deskBandClassName="bg-gradient-to-br from-teal-50/90 via-white to-sky-50/60"
      navSections={studentPortalSections}
      navItems={studentNavItems}
      dock={studentDock}
      dockColumns={4}
      inboxApiMode="account"
      searchPlaceholder="Search assignments, pages…"
      messagesHref="/app/student/messages"
      notificationsHref="/app/student/notifications"
      profileHref="/app/student/profile"
      headerSubtitle={identityLine}
      headerDesktopSubtitle={identityLine}
      headerMobileSubtitle={
        <>
          {shellExtras.className || "Class pending"}
          {classNumber != null ? ` · #${classNumber}` : ""}
        </>
      }
      yearTerm={yearTerm}
      errorBanner={error}
    >
      {children}
    </WorkspaceShell>
  );
}
