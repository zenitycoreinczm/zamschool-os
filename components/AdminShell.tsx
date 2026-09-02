"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { resolveAppWorkspaceHome } from "@/lib/auth-routing";
import { normalizeRole } from "@/lib/roles";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import WorkspaceShell, {
  WorkspaceShellDeskBand,
  workspaceShellInitials,
} from "@/components/workspace/WorkspaceShell";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";
import type { WorkspaceRoleKey } from "@/lib/workspace/nav";
import {
  buildRoleMobileDock,
  getRoleNavItems,
  roleNavSections,
} from "@/lib/workspace/nav";
import type { WorkspaceSearchResult } from "@/lib/workspace/search";

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const workspaceCtx = useWorkspaceContext() ?? undefined;
  const workspace = workspaceCtx?.data ?? null;
  const workspaceLoading = workspaceCtx?.loading ?? true;
  const workspaceError = workspaceCtx?.error ?? "";

  const ready = !workspaceLoading && Boolean(workspace);
  const role = normalizeWorkspaceRole(workspace?.workspaceRole);
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Your Account";
  const avatarUrl = workspace?.avatarUrl || null;

  useEffect(() => {
    if (!workspace) return;

    const redirectPath = resolveWorkspaceRedirect({
      workspaceRole: workspace.workspaceRole,
      emailConfirmed: workspace.emailConfirmed,
      schoolId: workspace.schoolId,
      pathname,
    });

    if (redirectPath) {
      router.replace(redirectPath);
    }
  }, [workspace, pathname, router]);

  const navSections = useMemo(
    () => (role ? (roleNavSections[role] ?? []) : []),
    [role],
  );
  const navItems = useMemo(() => (role ? getRoleNavItems(role) : []), [role]);
  const mobileDock = useMemo(
    () => (role ? buildRoleMobileDock(role) : []),
    [role],
  );
  const workspaceLabel = role ? getWorkspaceLabel(role) : "School workspace";
  const deskTitle = role ? getDeskTitle(role) : "Staff desk";

  if (workspaceError && !workspaceLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4">
        <div
          role="alert"
          className="max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-lg"
        >
          <h2 className="text-lg font-bold text-rose-700">
            Workspace access error
          </h2>
          <p className="mt-2 text-sm text-slate-600">{workspaceError}</p>
          <button
            onClick={() => router.push("/login")}
            className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  if (!ready || !role) {
    return (
      <WorkspaceLoader
        label="Loading your workspace"
        hint="Syncing school access and preferences"
      />
    );
  }

  const homeHref = resolveAppWorkspaceHome(role);

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
      sidebarId="admin-sidebar"
      homeHref={homeHref}
      brandTitle={schoolName}
      brandSubtitle={workspaceLabel}
      deskBand={
        <WorkspaceShellDeskBand label={deskTitle}>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">
            <span>{displayName}</span>
            <span className="mx-1.5 font-normal text-slate-300">|</span>
            <span className="font-medium text-slate-600">{workspaceLabel}</span>
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
      navSections={navSections}
      navItems={navItems}
      dock={mobileDock}
      inboxApiMode="account"
      searchPlaceholder="Search pages…"
      extraSearchItems={buildExtraSearchItems()}
      messagesHref="/app/messages"
      notificationsHref="/app/notifications"
      profileHref="/app/profile"
      profileChipClassName="border-slate-300 bg-slate-800 text-white"
      headerSubtitle={workspaceLabel}
      yearTerm={yearTerm}
    >
      {children}
    </WorkspaceShell>
  );
}

/** Role-agnostic page entries appended to the admin global search. */
function buildExtraSearchItems(): WorkspaceSearchResult[] {
  return [
    {
      id: "page:/app/messages-unread",
      kind: "page" as const,
      label: "Messages",
      hint: "Your inbox",
      href: "/app/messages",
    },
    {
      id: "page:/app/profile",
      kind: "page" as const,
      label: "Profile",
      hint: "Your account settings",
      href: "/app/profile",
    },
  ];
}

function normalizeWorkspaceRole(
  role: string | null | undefined,
): WorkspaceRoleKey | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  const stored = normalized.toLowerCase() as WorkspaceRoleKey;
  return roleNavSections[stored] ? stored : null;
}

type WorkspaceRedirectInput = {
  workspaceRole: string | null | undefined;
  emailConfirmed: boolean | null | undefined;
  schoolId: string | null | undefined;
  pathname: string;
};

function resolveWorkspaceRedirect({
  workspaceRole,
  emailConfirmed,
  schoolId,
  pathname,
}: WorkspaceRedirectInput): string | null {
  const nextRole = normalizeWorkspaceRole(workspaceRole);
  if (!nextRole) {
    return "/login?error=web_access_restricted";
  }

  if (!emailConfirmed) {
    return "/verify-email";
  }

  // Legacy admin is Head Teacher - allow principal workspace routes.
  // Old School Administrator home and the Users directory are not HT tools.
  if (
    (nextRole === "principal" || nextRole === "admin") &&
    pathname === "/app/dashboard"
  ) {
    return "/app/principal";
  }
  if (
    (nextRole === "principal" || nextRole === "admin") &&
    (pathname === "/app/admin/users" ||
      pathname.startsWith("/app/admin/users/") ||
      pathname === "/app/admin/staff-invitations" ||
      pathname.startsWith("/app/admin/staff-invitations/"))
  ) {
    return "/app/principal/staff";
  }
  if (nextRole === "deputy_head" && pathname === "/app/dashboard") {
    return "/app/deputy-head";
  }
  if (
    nextRole === "teacher" &&
    (pathname.startsWith("/app/admin") || pathname === "/app/dashboard")
  ) {
    return resolveAppWorkspaceHome(nextRole);
  }
  if (nextRole !== "teacher" && pathname === "/app/teacher") {
    return resolveAppWorkspaceHome(nextRole);
  }
  if (nextRole === "student" && pathname === "/app/parent") {
    return resolveAppWorkspaceHome(nextRole);
  }
  if (nextRole === "parent" && pathname === "/app/student") {
    return resolveAppWorkspaceHome(nextRole);
  }

  if (
    !schoolId &&
    (nextRole === "admin" || nextRole === "principal") &&
    pathname !== "/app/admin/school"
  ) {
    return "/app/admin/school";
  }

  return null;
}

function getWorkspaceLabel(role: WorkspaceRoleKey) {
  switch (role) {
    case "principal":
      return "Head Teacher";
    case "deputy_head":
      return "Deputy Head";
    case "bursar":
      return "Bursar";
    case "guidance_office":
      return "Guidance";
    case "academic_admin":
      return "Academic admin";
    case "hr_admin":
      return "HR admin";
    case "ict_admin":
      return "ICT admin";
    case "discipline_admin":
      return "Discipline";
    case "registrar":
      return "Registrar";
    case "admin":
      return "Head Teacher";
    case "super_admin":
      return "Super admin";
    default:
      return "Staff";
  }
}

function getDeskTitle(role: WorkspaceRoleKey) {
  switch (role) {
    case "registrar":
      return "Admissions desk";
    case "academic_admin":
      return "Academic desk";
    case "hr_admin":
      return "People desk";
    case "ict_admin":
      return "Technical desk";
    case "discipline_admin":
      return "Conduct desk";
    case "guidance_office":
      return "Welfare desk";
    case "principal":
      return "Leadership desk";
    case "deputy_head":
      return "Oversight desk";
    case "bursar":
      return "Finance desk";
    default:
      return "Staff desk";
  }
}
