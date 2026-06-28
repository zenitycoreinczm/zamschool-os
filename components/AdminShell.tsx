"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { resolveAppWorkspaceHome } from "@/lib/auth-routing";
import { normalizeRole } from "@/lib/roles";
import { useWorkspaceContext } from "@/components/WorkspaceContextProvider";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { getDisplayInitials } from "@/lib/display-initials";
import { WorkspaceShellHeader } from "@/components/workspace/WorkspaceShellHeader";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { MobileDock } from "@/components/workspace/MobileDock";
import {
  navItemsToWorkspacePages,
  type WorkspaceSearchResult,
} from "@/lib/workspace/search";
import {
  buildRoleMobileDock,
  getRoleNavItems,
  roleNavSections,
  type WorkspaceNavItem,
  type WorkspaceNavSection,
  type WorkspaceRoleKey,
} from "@/lib/workspace/nav";
import { LogOut, X } from "lucide-react";

type WorkspaceRole = WorkspaceRoleKey;

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: workspace, loading: workspaceLoading, error: workspaceError } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [polledUnread, setPolledUnread] = useState<{
    messages: number;
    notifications: number;
  } | null>(null);

  const ready = !workspaceLoading && Boolean(workspace);
  const role = normalizeWorkspaceRole(workspace?.workspaceRole);
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Your Account";
  const avatarUrl = workspace?.avatarUrl || null;
  const avatarInitials = getDisplayInitials({
    firstName: workspace?.firstName,
    lastName: workspace?.lastName,
    displayName,
    email: workspace?.email,
  });
  const workspaceUnread = useMemo(
    () => ({
      messages: workspace?.unread?.messages ?? 0,
      notifications: workspace?.unread?.notifications ?? 0,
    }),
    [workspace?.unread?.messages, workspace?.unread?.notifications],
  );
  const unreadSummary = polledUnread ?? workspaceUnread;

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

  // Unread counts are managed by WorkspaceInboxCenter via onUnreadChangeAction.

  const activeSet = useMemo(() => new Set([pathname]), [pathname]);
  const navSections = useMemo(
    () => (role ? (roleNavSections[role] ?? []) : []),
    [role],
  );
  const navItems = useMemo(() => (role ? getRoleNavItems(role) : []), [role]);
  const mobileDock = useMemo(
    () => (role ? buildRoleMobileDock(role) : []),
    [role],
  );
  const workspaceLabel = role ? getWorkspaceLabel(role) : "School Workspace";
  const workspacePageItems = useMemo(
    () => buildWorkspacePageItems(navItems, unreadSummary),
    [navItems, unreadSummary],
  );

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
          <h2 className="text-lg font-bold text-rose-700">Workspace Access Error</h2>
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

  if (!ready || !role) {
    return <WorkspaceLoader label="Workspace loading" />;
  }

  return (
    <div className={cn("zamschool-workspace-shell", ws.canvas)}>
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

      <AdminSidebar
        open={open}
        onClose={() => setOpen(false)}
        role={role}
        workspaceLabel={workspaceLabel}
        navSections={navSections}
        activePaths={activeSet}
        onNavigate={() => setOpen(false)}
        onSignOut={logout}
      />

      <div className="zamschool-workspace-shell__main">
        <WorkspaceShellHeader
          sidebarId="admin-sidebar"
          sidebarOpen={open}
          onOpenSidebar={() => setOpen(true)}
          schoolName={schoolName}
          yearTerm={yearTerm}
          pageItems={workspacePageItems}
          displayName={displayName}
          workspaceLabel={workspaceLabel}
          avatarUrl={avatarUrl}
          avatarInitials={avatarInitials}
          profileHref="/app/profile"
          settingsHref="/app/settings"
          apiMode="admin"
          messagesHref="/app/messages"
          notificationsHref="/app/notifications"
          initialUnread={unreadSummary}
          onUnreadChangeAction={setPolledUnread}
          onSignOut={logout}
        />

        <main id="main" className={ws.mainScroll}>
          <div className="relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6">
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={mobileDock}
          onClose={() => setOpen(false)}
          activeAccent="sky"
          columns={5}
        />
      </div>
    </div>
  );
}

type ShellAction = () => void | Promise<void>;

type AdminSidebarProps = {
  open: boolean;
  onClose: () => void;
  role: WorkspaceRole;
  workspaceLabel: string;
  navSections: WorkspaceNavSection[];
  activePaths: Set<string>;
  onNavigate: () => void;
  onSignOut: ShellAction;
};

function AdminSidebar({
  open,
  onClose,
  role,
  workspaceLabel,
  navSections,
  activePaths,
  onNavigate,
  onSignOut,
}: AdminSidebarProps) {
  return (
    <aside
      id="admin-sidebar"
      role="navigation"
      aria-label="Primary"
      className={`zamschool-workspace-shell__sidebar transition-transform duration-250 ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      }`}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="px-3 py-2.5 border-b border-slate-200/80 flex items-center justify-between">
          <Link
            href={resolveAppWorkspaceHome(role)}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-full overflow-hidden shadow-sm bg-white">
              <Image
                src="/icon.png"
                alt="ZamSchool OS"
                width={32}
                height={32}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-sm">
                ZamSchool OS
              </p>
              <p className="text-[10px] text-slate-500">{workspaceLabel}</p>
            </div>
          </Link>
          <button className="lg:hidden p-2 text-slate-500" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3">
          <WorkspaceNavMenu
            sections={navSections}
            activePaths={activePaths}
            onNavigate={onNavigate}
          />
        </div>

        <div className="p-2 border-t border-slate-200/80">
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

function formatUnreadBadgeCount(count: number) {
  if (!count || count < 1) {
    return "0";
  }

  return count > 99 ? "99+" : String(count);
}

function buildWorkspacePageItems(
  navItems: WorkspaceNavItem[],
  unreadSummary: { messages: number; notifications: number },
): WorkspaceSearchResult[] {
  return [
    ...navItemsToWorkspacePages(navItems),
    {
      id: "page:/app/messages-unread",
      kind: "page" as const,
      label: "Unread Messages",
      hint: `${formatUnreadBadgeCount(unreadSummary.messages)} unread`,
      href: "/app/messages",
    },
    {
      id: "page:/app/notifications-unread",
      kind: "page" as const,
      label: "Unread Notifications",
      hint: `${formatUnreadBadgeCount(unreadSummary.notifications)} unread`,
      href: "/app/notifications",
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
): WorkspaceRole | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;
  const stored = normalized.toLowerCase() as WorkspaceRole;
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

  if (nextRole === "admin" && pathname.startsWith("/app/principal")) {
    return "/app/dashboard";
  }
  if (nextRole === "principal" && pathname === "/app/dashboard") {
    return "/app/principal";
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
    ["admin", "principal"].includes(nextRole) &&
    pathname !== "/app/admin/school"
  ) {
    return "/app/admin/school";
  }

  return null;
}

function getWorkspaceLabel(role: WorkspaceRole) {
  switch (role) {
    case "principal":
      return "Head Teacher workspace";
    case "deputy_head":
      return "Deputy Head Workspace";
    case "bursar":
      return "Bursar Workspace";
    case "guidance_office":
      return "Guidance Office Workspace";
    case "academic_admin":
      return "Academic Admin Workspace";
    case "hr_admin":
      return "HR Admin Workspace";
    case "ict_admin":
      return "ICT Admin Workspace";
    case "discipline_admin":
      return "Discipline Workspace";
    case "registrar":
      return "Registrar Workspace";
    case "admin":
      return "School Administrator Workspace";
    case "super_admin":
      return "Super Admin Workspace";
    case "teacher":
      return "Teacher Workspace";
    case "payments":
      return "Payments Workspace";
    case "student":
      return "Student Workspace";
    case "parent":
      return "Parent Workspace";
    default:
      return "School Workspace";
  }
}
