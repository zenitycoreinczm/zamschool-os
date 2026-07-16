"use client";

/* eslint-disable react-hooks/set-state-in-effect -- badge state synchronizes external unread/feed sources. */

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { fetchAnnouncementsList } from "@/lib/announcements-client";
import { fetchAccountEventsList } from "@/lib/events-client";
import {
  fetchUnreadSummary,
  type InboxApiMode,
} from "@/lib/inbox/center-client";
import { INBOX_REFRESH_EVENT } from "@/lib/inbox/events";
import {
  buildBadgeByHref,
  countNewSinceSeen,
  EMPTY_NAV_BADGES,
  markNavSectionsSeenForPath,
  readNavSectionSeenAt,
  type NavBadgeCounts,
} from "@/lib/workspace/nav-badges";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

const POLL_MS = 60_000;
const LIST_LIMIT = 40;

type UseNavBadgesOptions = {
  /** Account/admin/teacher unread-summary API mode. */
  apiMode?: InboxApiMode;
  /** Hrefs currently rendered in the sidebar/dock (for badge map). */
  hrefs?: string[];
  /** When false, skip announcements/events list fetches. */
  trackFeedSections?: boolean;
  /** Seed counts (e.g. teacher workload) before the first poll. */
  initialMessages?: number;
  initialNotifications?: number;
};

function resolveAnnouncementsEndpoint(role: string | null | undefined): string {
  const r = String(role || "").toLowerCase();
  if (r === "teacher") {
    return `/api/teacher/announcements?limit=${LIST_LIMIT}`;
  }
  if (
    [
      "principal",
      "admin",
      "super_admin",
      "deputy_head",
      "bursar",
      "guidance_office",
      "academic_admin",
      "hr_admin",
      "ict_admin",
      "discipline_admin",
      "registrar",
    ].includes(r)
  ) {
    return `/api/admin/announcements?limit=${LIST_LIMIT}`;
  }
  return `/api/account/announcements?limit=${LIST_LIMIT}`;
}

/**
 * Live nav badge counts for messages, notifications, announcements, and events.
 * Messages/notifications use the shared unread-summary API; announcements/events
 * use “new since last visit” (localStorage) against list endpoints.
 */
export function useNavBadges(options: UseNavBadgesOptions = {}) {
  const {
    apiMode = "account",
    hrefs = [],
    trackFeedSections = true,
    initialMessages,
    initialNotifications,
  } = options;

  const pathname = usePathname();
  const { data: workspace } = useWorkspaceContext();
  const userId = workspace?.userId || "";
  const role = workspace?.workspaceRole || workspace?.role || null;
  const schoolId = String(workspace?.schoolId || "").trim();
  // Platform super_admin has no school - skip school-scoped feed badge fan-out.
  const canTrackSchoolFeeds = Boolean(schoolId);
  const workspaceUserId = workspace?.userId || "";

  const [counts, setCounts] = useState<NavBadgeCounts>(() => ({
    ...EMPTY_NAV_BADGES,
    messages: initialMessages ?? workspace?.unread?.messages ?? 0,
    notifications:
      initialNotifications ?? workspace?.unread?.notifications ?? 0,
  }));

  // When the authenticated user changes, zero badges until the live summary loads.
  useEffect(() => {
    if (!workspaceUserId) return;
    setCounts({ ...EMPTY_NAV_BADGES });
  }, [workspaceUserId]);

  // Seed from explicit initial values (teacher workload) only once per value -
  // never overwrite fresher unread-summary results with stale workspace.unread.
  useEffect(() => {
    if (typeof initialMessages === "number") {
      setCounts((prev) => ({ ...prev, messages: initialMessages }));
    }
  }, [initialMessages]);

  useEffect(() => {
    if (typeof initialNotifications === "number") {
      setCounts((prev) => ({
        ...prev,
        notifications: initialNotifications,
      }));
    }
  }, [initialNotifications]);

  const loadCounts = useCallback(async () => {
    if (!userId) return;

    try {
      const summary = await fetchUnreadSummary(apiMode, { force: true });
      setCounts((prev) => ({
        ...prev,
        messages: summary.messages,
        notifications: summary.notifications,
      }));
    } catch {
      // keep previous
    }

    if (!trackFeedSections || !canTrackSchoolFeeds) return;

    try {
      // Visiting the page itself counts as read for feed sections.
      const viewingAnnouncements = pathname.includes("/announcements");
      const viewingEvents =
        pathname === "/app/events" ||
        pathname.startsWith("/app/events/") ||
        pathname.includes("/events");

      if (viewingAnnouncements) {
        markNavSectionsSeenForPath(userId, pathname);
      }
      if (viewingEvents) {
        markNavSectionsSeenForPath(userId, pathname);
      }

      const annEndpoint = resolveAnnouncementsEndpoint(role);
      const [annRows, eventRows] = await Promise.all([
        viewingAnnouncements
          ? Promise.resolve([])
          : fetchAnnouncementsList(annEndpoint).catch(() => []),
        viewingEvents
          ? Promise.resolve([])
          : fetchAccountEventsList(
              `/api/account/events?upcomingOnly=false&limit=${LIST_LIMIT}`,
            ).catch(() => []),
      ]);

      const annSeen = readNavSectionSeenAt(userId, "announcements");
      const eventSeen = readNavSectionSeenAt(userId, "events");

      setCounts((prev) => ({
        ...prev,
        announcements: viewingAnnouncements
          ? 0
          : countNewSinceSeen(
              annRows as Array<{
                created_at?: string | null;
                published_at?: string | null;
              }>,
              annSeen,
            ),
        events: viewingEvents
          ? 0
          : countNewSinceSeen(
              eventRows as Array<{
                created_at?: string | null;
                published_at?: string | null;
              }>,
              eventSeen,
            ),
      }));
    } catch {
      // keep previous
    }
  }, [apiMode, canTrackSchoolFeeds, pathname, role, trackFeedSections, userId]);

  // Initial load + poll + inbox refresh bus.
  useEffect(() => {
    if (!userId) return;

    void loadCounts();
    const interval = window.setInterval(() => {
      void loadCounts();
    }, POLL_MS);

    const onRefresh = () => {
      void loadCounts();
    };
    window.addEventListener(INBOX_REFRESH_EVENT, onRefresh);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener(INBOX_REFRESH_EVENT, onRefresh);
    };
  }, [loadCounts, userId]);

  // Clear feed badges when the user opens announcements/events.
  useEffect(() => {
    if (!userId || !pathname) return;
    const cleared = markNavSectionsSeenForPath(userId, pathname);
    if (cleared.length === 0) return;

    setCounts((prev) => {
      const next = { ...prev };
      for (const key of cleared) {
        next[key] = 0;
      }
      return next;
    });
  }, [pathname, userId]);

  const badgeByHref = useMemo(
    () => buildBadgeByHref(counts, hrefs),
    [counts, hrefs],
  );

  return {
    counts,
    badgeByHref,
    refresh: loadCounts,
  };
}
