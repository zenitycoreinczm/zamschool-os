"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { fetchShell } from "@/lib/shell-client";
import {
  buildParentPortalDock,
  flattenNavSections,
  parentPortalSections,
} from "@/lib/workspace/nav";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import WorkspaceShell, {
  WorkspaceShellDeskBand,
  workspaceShellInitials,
} from "@/components/workspace/WorkspaceShell";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

const parentNavItems = flattenNavSections(parentPortalSections);
const parentDock = buildParentPortalDock();

export default function ParentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaceCtx = useWorkspaceContext();
  const workspace = workspaceCtx?.data ?? null;
  const role = workspaceCtx?.role ?? null;
  const loading = workspaceCtx?.loading ?? true;
  const error = workspaceCtx?.error ?? "";
  const [childrenCount, setChildrenCount] = useState<number | null>(null);

  useEffect(() => {
    if (!workspace) return;

    if (role !== "parent") {
      router.replace("/login?error=parent_access_required");
      return;
    }

    if (!workspace.emailConfirmed) {
      router.replace("/verify-email");
    }
  }, [workspace, role, router]);

  useEffect(() => {
    if (role !== "parent") return;
    let cancelled = false;

    fetchShell()
      .then((shell) => {
        if (cancelled) return;
        const count = (shell.shell as { childrenCount?: number } | undefined)
          ?.childrenCount;
        setChildrenCount(typeof count === "number" ? count : 0);
      })
      .catch(() => {
        if (!cancelled) setChildrenCount(null);
      });

    return () => {
      cancelled = true;
    };
  }, [role]);

  const ready = !loading && Boolean(workspace) && role === "parent";
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Parent";
  const avatarUrl = workspace?.avatarUrl || null;
  const childrenLabel =
    childrenCount == null
      ? "Linked children"
      : childrenCount === 1
        ? "1 child"
        : `${childrenCount} children`;

  if (!ready) {
    return (
      <WorkspaceLoader
        label="Loading parent portal"
        hint="Syncing linked children and account"
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
      sidebarId="parent-sidebar"
      homeHref="/app/parent"
      brandTitle={schoolName}
      brandSubtitle="Parent"
      deskBand={
        <WorkspaceShellDeskBand label="Family desk">
          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">
            <span>{displayName}</span>
            <span className="mx-1.5 font-normal text-slate-300">|</span>
            <span className="font-medium text-slate-600">{childrenLabel}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            <AcademicContextLabel
              value={yearTerm}
              yearClassName="font-medium text-slate-600"
              termClassName="text-slate-400"
            />
          </p>
        </WorkspaceShellDeskBand>
      }
      navSections={parentPortalSections}
      navItems={parentNavItems}
      dock={parentDock}
      inboxApiMode="account"
      searchPlaceholder="Search children, attendance…"
      messagesHref="/app/parent/messages"
      notificationsHref="/app/parent/notifications"
      profileHref="/app/parent/profile"
      headerSubtitle={childrenLabel}
      yearTerm={yearTerm}
      errorBanner={error}
    >
      {children}
    </WorkspaceShell>
  );
}
