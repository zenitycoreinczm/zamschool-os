"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, MoreHorizontal, Settings, Users } from "lucide-react";

import { ProfileAvatarImage } from "@/components/ProfileAvatarImage";
import { WorkspaceInboxCenter } from "@/components/inbox/WorkspaceInboxCenter";
import { WorkspaceGlobalSearch } from "@/components/workspace/WorkspaceGlobalSearch";
import { ws } from "@/lib/workspace/design";
import type { WorkspaceSearchResult } from "@/lib/workspace/search";
import type { InboxApiMode } from "@/lib/inbox/center-client";
import { cn } from "@/lib/utils";

type WorkspaceShellHeaderProps = {
  sidebarId: string;
  sidebarOpen: boolean;
  onOpenSidebar: () => void;
  schoolName: string;
  yearTerm: string;
  pageItems: WorkspaceSearchResult[];
  searchPlaceholder?: string;
  displayName: string;
  workspaceLabel: string;
  avatarUrl: string | null;
  avatarInitials: string;
  profileHref: string;
  settingsHref: string;
  apiMode?: InboxApiMode;
  messagesHref: string;
  notificationsHref: string;
  initialUnread?: { messages: number; notifications: number };
  onUnreadChangeAction?: (counts: {
    messages: number;
    notifications: number;
  }) => void;
  onSignOut: () => void | Promise<void>;
  className?: string;
};

export function WorkspaceShellHeader({
  sidebarId,
  sidebarOpen,
  onOpenSidebar,
  schoolName,
  yearTerm,
  pageItems,
  searchPlaceholder,
  displayName,
  workspaceLabel,
  avatarUrl,
  avatarInitials,
  profileHref,
  settingsHref,
  apiMode = "account",
  messagesHref,
  notificationsHref,
  initialUnread,
  onUnreadChangeAction,
  onSignOut,
  className,
}: WorkspaceShellHeaderProps) {
  const router = useRouter();
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (actionsRef.current && !actionsRef.current.contains(target)) {
        setOverflowOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleNavigate = (href: string) => {
    setOverflowOpen(false);
    router.push(href);
  };

  const profileAvatar = useMemo(
    () =>
      avatarUrl ? (
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
      ),
    [avatarInitials, avatarUrl, displayName],
  );

  return (
    <header
      className={cn(
        ws.header,
        "flex items-center justify-between gap-3 border-b border-workspace-border/60 px-4 py-2.5 md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          className="-ml-2 p-2 text-slate-600 lg:hidden"
          onClick={onOpenSidebar}
          aria-expanded={sidebarOpen}
          aria-controls={sidebarId}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate font-semibold text-slate-900">{schoolName}</p>
          <p className="truncate text-xs text-slate-500">{yearTerm}</p>
        </div>
      </div>

      <WorkspaceGlobalSearch
        pageItems={pageItems}
        placeholder={searchPlaceholder}
        className="hidden min-w-0 flex-1 sm:block sm:max-w-[360px]"
      />

      <div ref={actionsRef} className={cn("relative flex items-center gap-3", ws.headerActions)}>
        <WorkspaceInboxCenter
          apiMode={apiMode}
          messagesHref={messagesHref}
          notificationsHref={notificationsHref}
          initialUnread={initialUnread}
          onUnreadChangeAction={onUnreadChangeAction}
        />

        <div className="hidden items-center gap-3 pl-2 sm:flex">
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-slate-800">{displayName}</p>
            <p className="text-[11px] text-slate-400">{workspaceLabel}</p>
          </div>
          <Link
            href={profileHref}
            className="group relative grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:ring-2 hover:ring-sky-100 focus-visible:ring-2 focus-visible:ring-sky-100"
          >
            {profileAvatar}
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOverflowOpen((current) => !current)}
          className="hidden h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 sm:grid"
          aria-expanded={overflowOpen}
          aria-label="Open account menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {overflowOpen ? (
          <div
            className={cn(
              "absolute right-0 top-12 w-56 rounded-3xl border border-slate-200 bg-white p-2 shadow-xl",
              ws.popover,
            )}
          >
            <button
              type="button"
              onClick={() => handleNavigate(profileHref)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Users className="h-4 w-4 text-slate-400" />
              Profile
            </button>
            <button
              type="button"
              onClick={() => handleNavigate(settingsHref)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                setOverflowOpen(false);
                void onSignOut();
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
