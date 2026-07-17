"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { resolveAppWorkspaceHome } from "@/lib/auth-routing";
import { normalizeRole } from "@/lib/roles";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { getDisplayInitials } from "@/lib/display-initials";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { WorkspaceInboxCenter } from "@/components/inbox/WorkspaceInboxCenter";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { MobileDock } from "@/components/workspace/MobileDock";
import { useNavBadges } from "@/components/workspace/useNavBadges";
import {
  navItemsToWorkspacePages,
  type WorkspaceSearchResult,
} from "@/lib/workspace/search";
import {
  buildRoleMobileDock,
  getRoleNavItems,
  roleNavSections,
  type WorkspaceNavItem,
  type WorkspaceRoleKey,
} from "@/lib/workspace/nav";
import { formatNavBadgeCount } from "@/lib/workspace/nav-badges";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type WorkspaceRole = WorkspaceRoleKey;

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
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
  const navHrefs = useMemo(
    () => [
      ...navItems.map((item) => item.href),
      ...mobileDock.map((item) => item.href),
    ],
    [navItems, mobileDock],
  );
  const { counts: navBadgeCounts, badgeByHref } = useNavBadges({
    apiMode: "account",
    hrefs: navHrefs,
    trackFeedSections: true,
  });
  const unreadMessages = navBadgeCounts.messages;
  const workspaceLabel = role ? getWorkspaceLabel(role) : "School workspace";
  const deskTitle = role ? getDeskTitle(role) : "Staff desk";
  const workspacePageItems = useMemo(
    () => buildWorkspacePageItems(navItems, unreadMessages),
    [navItems, unreadMessages],
  );
  const profileHref = roleProfileHref(role);
  const homeHref = role ? resolveAppWorkspaceHome(role) : "/app/dashboard";

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
        id="admin-sidebar"
        role="navigation"
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[17.5rem] border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
            <Link href={homeHref} className="flex min-w-0 items-center gap-3">
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
                  {workspaceLabel}
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

          <div className="border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/30 px-4 py-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {deskTitle}
            </p>
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
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <WorkspaceNavMenu
              sections={navSections}
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
              aria-controls="admin-sidebar"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 lg:hidden">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {workspaceLabel}
              </p>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate text-sm font-semibold text-slate-900">
                <AcademicContextLabel value={yearTerm} />
              </p>
              <p className="truncate text-xs text-slate-500">
                {displayName} · {workspaceLabel}
              </p>
            </div>
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder="Search pages…"
            className="hidden min-w-0 flex-1 sm:block sm:max-w-[320px]"
          />

          <div className="flex items-center gap-2 sm:gap-3">
            <WorkspaceInboxCenter
              apiMode="account"
              messagesHref="/app/messages"
              notificationsHref="/app/notifications"
              initialUnread={{
                messages: navBadgeCounts.messages,
                notifications: navBadgeCounts.notifications,
              }}
            />
            <Link
              href={profileHref}
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

        <main id="main" className={cn(ws.mainScroll, "flex-1")}>
          <div className="relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6">
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={mobileDock}
          onClose={() => setOpen(false)}
          activeAccent="slate"
          columns={5}
          badgeByHref={badgeByHref}
        />
      </div>
    </div>
  );
}

function buildWorkspacePageItems(
  navItems: WorkspaceNavItem[],
  unreadMessages: number,
): WorkspaceSearchResult[] {
  return [
    ...navItemsToWorkspacePages(navItems),
    {
      id: "page:/app/messages-unread",
      kind: "page" as const,
      label: "Messages",
      hint: `${formatNavBadgeCount(unreadMessages) || "0"} unread`,
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

function getWorkspaceLabel(role: WorkspaceRole) {
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

function getDeskTitle(role: WorkspaceRole) {
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

function roleProfileHref(_role: WorkspaceRole | null) {
  return "/app/profile";
}
