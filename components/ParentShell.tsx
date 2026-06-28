"use client";

import Image from "next/image";
import Link from "next/link";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { getDisplayInitials } from "@/lib/display-initials";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";

import { WorkspaceInboxCenter } from "@/components/inbox/WorkspaceInboxCenter";
import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { useWorkspaceContext } from "@/components/WorkspaceContextProvider";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { MobileDock } from "@/components/workspace/MobileDock";
import { navItemsToWorkspacePages } from "@/lib/workspace/search";
import {
  buildParentPortalDock,
  flattenNavSections,
  parentPortalSections,
} from "@/lib/workspace/nav";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

const parentNavItems = flattenNavSections(parentPortalSections);
const parentDock = buildParentPortalDock();

export default function ParentShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: workspace, role, loading, error } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const workspacePageItems = useMemo(
    () => navItemsToWorkspacePages(parentNavItems),
    [],
  );

  useEffect(() => {
    if (!workspace) {
      return;
    }

    if (role !== "parent") {
      router.replace("/login?error=parent_access_required");
      return;
    }

    if (!workspace.emailConfirmed) {
      router.replace("/verify-email");
    }
  }, [workspace, role, router]);

  const ready = !loading && Boolean(workspace) && role === "parent";
  const schoolName = workspace?.schoolName || "Your School";
  const yearTerm = workspace?.yearTerm || "Academic Context";
  const displayName = workspace?.displayName || "Parent";
  const avatarUrl = workspace?.avatarUrl || null;
  const unreadSummary = {
    messages: workspace?.unread?.messages ?? 0,
    notifications: workspace?.unread?.notifications ?? 0,
  };
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

  if (!ready) {
    return <WorkspaceLoader label="Preparing parent portal" />;
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
        id="parent-sidebar"
        role="navigation"
        aria-label="Primary"
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-5">
            <Link href="/app/parent" className="flex items-center gap-3">
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
                <p className="font-semibold leading-tight text-slate-900">
                  ZamSchool OS
                </p>
                <p className="text-xs leading-tight text-slate-500">
                  Parent Portal
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

          <div className="flex-1 overflow-y-auto px-3 py-5">
            <WorkspaceNavMenu
              sections={parentPortalSections}
              activePaths={activeSet}
              onNavigate={() => setOpen(false)}
              accent="teal"
            />
          </div>

          <div className="border-t border-slate-200/80 p-3">
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-white hover:text-red-600"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="zamschool-workspace-shell__main flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            ws.header,
            "flex items-center justify-between gap-4 border-b border-workspace-border/60 px-4 py-3.5 md:px-6",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="-ml-2 p-2 text-slate-600 lg:hidden"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="parent-sidebar"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 lg:block">
              <p className="truncate font-semibold text-slate-900">
                {schoolName}
              </p>
              <p className="truncate text-xs text-slate-500">{yearTerm}</p>
            </div>
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder="Search children, attendance, results…"
            className="hidden min-w-0 flex-1 sm:block sm:max-w-[360px]"
          />

          <div className="flex items-center gap-3">
            <WorkspaceInboxCenter
              messagesHref="/app/parent/messages"
              notificationsHref="/app/parent/notifications"
              initialUnread={unreadSummary}
            />
            <div className="hidden items-center gap-3 pl-2 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-slate-800">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-400">Parent</p>
              </div>
              <Link
                href="/app/parent/profile"
                className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-teal-200 bg-teal-600 text-sm font-semibold text-white shadow-sm"
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
          items={parentDock}
          onClose={() => setOpen(false)}
          activeAccent="teal"
          columns={5}
        />
      </div>
    </div>
  );
}
