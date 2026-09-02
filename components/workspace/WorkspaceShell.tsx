"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { performWorkspaceSignOut } from "@/lib/workspace/sign-out";
import { WorkspaceNavMenu } from "@/components/workspace/WorkspaceNavMenu";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { WorkspaceInboxCenter } from "@/components/inbox/WorkspaceInboxCenter";
import { MobileDock } from "@/components/workspace/MobileDock";
import { useNavBadges } from "@/components/workspace/useNavBadges";
import { navItemsToWorkspacePages, type WorkspaceSearchResult } from "@/lib/workspace/search";
import type { ShellNavAccent } from "@/lib/workspace/design";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { getDisplayInitials } from "@/lib/display-initials";
import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";
import type { WorkspaceNavItem, WorkspaceNavSection } from "@/lib/workspace/nav";

type DockAccent = "sky" | "teal" | "green" | "neutral" | "slate";

type InboxApiMode = React.ComponentProps<typeof WorkspaceInboxCenter>["apiMode"];

/**
 * Shared workspace chrome: sidebar frame, brand block, desk band slot, nav,
 * header identity cluster, global search, inbox, profile, main scroll area,
 * and mobile dock.
 *
 * Role-specific logic (auth gates, role fetches, stat tiles, loader labels)
 * stays in each shell wrapper; the wrappers compose those pieces into the
 * props below. Standard header mode (default) renders
 * "displayName / subtitle" on mobile and "yearTerm / displayName · subtitle"
 * on desktop; pass headerMobileIdentity / headerDesktopIdentity to override
 * the whole cluster (e.g. the payments workspace).
 */
export type WorkspaceShellProps = {
  children: React.ReactNode;
  pathname: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitials: string;
  sidebarId: string;
  homeHref: string;
  brandTitle: string;
  brandSubtitle: string;
  brandSubtitleClassName?: string;
  /** Identity panel under the brand block ("Family desk", "Your desk"...). */
  deskBand?: React.ReactNode;
  deskBandClassName?: string;
  /** Additional band above the nav (stat tiles, payments summary...). */
  extraSidebarBand?: React.ReactNode;
  navSections: WorkspaceNavSection[];
  navItems: WorkspaceNavItem[];
  navAccent?: ShellNavAccent;
  dock: WorkspaceNavItem[];
  dockAccent?: DockAccent;
  dockColumns?: 4 | 5;
  inboxApiMode: InboxApiMode;
  badgeInitialMessages?: number;
  badgeInitialNotifications?: number;
  searchPlaceholder: string;
  searchMaxWidthClassName?: string;
  extraSearchItems?: WorkspaceSearchResult[];
  messagesHref: string;
  notificationsHref: string;
  profileHref: string;
  profileChipClassName?: string;
  /** Extra block rendered before the avatar in the header right cluster. */
  profileAside?: React.ReactNode;
  /** Standard-mode subtitle (mobile sub-label and "displayName · X" desktop). */
  headerSubtitle?: React.ReactNode;
  /** Standard-mode mobile subtitle override (e.g. teacher shows the term). */
  headerMobileSubtitle?: React.ReactNode;
  /** Standard-mode desktop subtitle override (already includes the name). */
  headerDesktopSubtitle?: React.ReactNode;
  /** Manual header identity cluster (overrides standard mode entirely). */
  headerMobileIdentity?: React.ReactNode;
  headerDesktopIdentity?: React.ReactNode;
  yearTerm?: string;
  errorBanner?: string | null;
  mainInnerClassName?: string;
  rootClassName?: string;
  sidebarClassName?: string;
  mainShellClassName?: string;
  mainClassName?: string;
};

export default function WorkspaceShell({
  children,
  pathname,
  displayName,
  avatarUrl,
  avatarInitials,
  sidebarId,
  homeHref,
  brandTitle,
  brandSubtitle,
  brandSubtitleClassName,
  deskBand,
  deskBandClassName,
  extraSidebarBand,
  navSections,
  navItems,
  navAccent = "slate",
  dock,
  dockAccent = "slate",
  dockColumns = 5,
  inboxApiMode,
  badgeInitialMessages,
  badgeInitialNotifications,
  searchPlaceholder,
  searchMaxWidthClassName = "sm:max-w-[320px]",
  extraSearchItems,
  messagesHref,
  notificationsHref,
  profileHref,
  profileChipClassName = "border-slate-200 bg-slate-100 text-slate-800",
  profileAside,
  headerSubtitle,
  headerMobileSubtitle,
  headerDesktopSubtitle,
  headerMobileIdentity,
  headerDesktopIdentity,
  yearTerm,
  errorBanner,
  mainInnerClassName,
  rootClassName,
  sidebarClassName,
  mainShellClassName,
  mainClassName,
}: WorkspaceShellProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activePaths = useMemo(() => new Set([pathname]), [pathname]);
  const navHrefs = useMemo(
    () => [...navItems.map((item) => item.href), ...dock.map((item) => item.href)],
    [navItems, dock],
  );
  const { counts: navBadgeCounts, badgeByHref } = useNavBadges({
    apiMode: inboxApiMode,
    hrefs: navHrefs,
    trackFeedSections: true,
    initialMessages: badgeInitialMessages,
    initialNotifications: badgeInitialNotifications,
  });
  const workspacePageItems = useMemo(() => {
    const base = navItemsToWorkspacePages(navItems);
    return extraSearchItems?.length ? [...base, ...extraSearchItems] : base;
  }, [navItems, extraSearchItems]);

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

  const mobileIdentity =
    headerMobileIdentity !== undefined ? (
      headerMobileIdentity
    ) : (
      <>
        <p className="truncate text-sm font-semibold text-slate-900">
          {displayName}
        </p>
        <p className="truncate text-[11px] text-slate-500">
          {headerMobileSubtitle ?? headerSubtitle}
        </p>
      </>
    );

  const desktopIdentity =
    headerDesktopIdentity !== undefined ? (
      headerDesktopIdentity
    ) : (
      <>
        <p className="truncate text-sm font-semibold text-slate-900">
          <AcademicContextLabel value={yearTerm || "Academic Context"} />
        </p>
        <p className="truncate text-xs text-slate-500">
          {headerDesktopSubtitle ?? (
            <>
              {displayName}
              {headerSubtitle ? <> · {headerSubtitle}</> : null}
            </>
          )}
        </p>
      </>
    );

  return (
    <div
      className={cn(
        rootClassName ?? "flex h-screen overflow-hidden",
        ws.canvas,
      )}
    >
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
        id={sidebarId}
        role="navigation"
        aria-label="Primary"
        className={cn(
          sidebarClassName ??
            "fixed inset-y-0 left-0 z-40 w-[17.5rem] border-r border-workspace-border bg-workspace-sidebar transition-transform duration-[var(--duration-workspace-normal)] lg:relative",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
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
                  {brandTitle}
                </p>
                <p
                  className={cn(
                    "truncate text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500",
                    brandSubtitleClassName,
                  )}
                >
                  {brandSubtitle}
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

          {deskBand ? (
            <div
              className={cn(
                "border-b border-slate-200/80 bg-gradient-to-br from-slate-50 via-white to-sky-50/40 px-4 py-3.5",
                deskBandClassName,
              )}
            >
              {deskBand}
            </div>
          ) : null}

          {extraSidebarBand}

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <WorkspaceNavMenu
              sections={navSections}
              activePaths={activePaths}
              onNavigate={() => setOpen(false)}
              accent={navAccent}
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

      <div
        className={cn(
          mainShellClassName ??
            "zamschool-workspace-shell__main flex min-w-0 flex-1 flex-col",
        )}
      >
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
              aria-controls={sidebarId}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {mobileIdentity ? (
              <div className="min-w-0 lg:hidden">{mobileIdentity}</div>
            ) : null}
            {desktopIdentity ? (
              <div className="hidden min-w-0 lg:block">{desktopIdentity}</div>
            ) : null}
          </div>

          <WorkspaceGlobalSearch
            pageItems={workspacePageItems}
            placeholder={searchPlaceholder}
            className={cn(
              "hidden min-w-0 flex-1 sm:block",
              searchMaxWidthClassName,
            )}
          />

          <div className="flex items-center gap-2 sm:gap-3">
            <WorkspaceInboxCenter
              apiMode={inboxApiMode}
              messagesHref={messagesHref}
              notificationsHref={notificationsHref}
              initialUnread={{
                messages: navBadgeCounts.messages,
                notifications: navBadgeCounts.notifications,
              }}
            />
            {profileAside}
            <Link
              href={profileHref}
              className={cn(
                "relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border text-sm font-semibold shadow-sm",
                profileChipClassName,
              )}
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

        {errorBanner ? (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6"
          >
            {errorBanner}
          </div>
        ) : null}

        <main
          id="main"
          className={mainClassName ?? cn(ws.mainScroll, "flex-1")}
        >
          <div
            className={cn(
              "relative z-0 zamschool-workspace-main-inner animate-enter-up space-y-5 pb-24 lg:pb-6",
              mainInnerClassName,
            )}
          >
            {children}
          </div>
        </main>

        <MobileDock
          pathname={pathname}
          items={dock}
          onClose={() => setOpen(false)}
          activeAccent={dockAccent}
          columns={dockColumns}
          badgeByHref={badgeByHref}
        />
      </div>
    </div>
  );
}

/** Standard desk-band building block so wrappers keep identical typography. */
export function WorkspaceShellDeskBand({
  label,
  children,
  labelClassName,
}: {
  label: string;
  children: React.ReactNode;
  labelClassName?: string;
}) {
  return (
    <>
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500",
          labelClassName,
        )}
      >
        {label}
      </p>
      {children}
    </>
  );
}

/** Convenience helper mirroring the wrappers' initials computation. */
export function workspaceShellInitials(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  email?: string | null;
}): string {
  return getDisplayInitials({
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    displayName: input.displayName ?? undefined,
    email: input.email ?? undefined,
  });
}
