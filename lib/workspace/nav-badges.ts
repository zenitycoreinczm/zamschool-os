/**
 * Sidebar / dock badge helpers for unread messages, notifications,
 * and “new since last visit” announcements & events.
 */

export type NavBadgeKey =
  | "messages"
  | "notifications"
  | "announcements"
  | "events";

export type NavBadgeCounts = Record<NavBadgeKey, number>;

export const EMPTY_NAV_BADGES: NavBadgeCounts = {
  messages: 0,
  notifications: 0,
  announcements: 0,
  events: 0,
};

/** Paths that clear a section’s “new” badge when the user opens them. */
const SECTION_PATH_MATCHERS: Record<
  Exclude<NavBadgeKey, "messages" | "notifications">,
  (pathname: string) => boolean
> = {
  announcements: (pathname) =>
    pathname.includes("/announcements") || pathname.endsWith("/announcements"),
  events: (pathname) =>
    pathname === "/app/events" ||
    pathname.startsWith("/app/events/") ||
    pathname.includes("/events"),
};

/** Map any messages/inbox/notifications/announcements/events href → badge key. */
export function badgeKeyForHref(href: string): NavBadgeKey | null {
  const path = href.split("?")[0] || href;
  if (
    path.endsWith("/messages") ||
    path.endsWith("/inbox") ||
    path.includes("/messages") ||
    path.includes("/inbox")
  ) {
    return "messages";
  }
  if (path.includes("/notifications")) {
    return "notifications";
  }
  if (path.includes("/announcements")) {
    return "announcements";
  }
  if (path.includes("/events")) {
    return "events";
  }
  return null;
}

export function formatNavBadgeCount(count: number): string {
  if (!count || count < 1) return "";
  return count > 99 ? "99+" : String(count);
}

export function buildBadgeByHref(
  counts: NavBadgeCounts,
  hrefs: string[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const href of hrefs) {
    const key = badgeKeyForHref(href);
    if (!key) continue;
    const value = counts[key] ?? 0;
    if (value > 0) {
      map[href] = value;
    }
  }
  return map;
}

const SEEN_STORAGE_PREFIX = "zamschool:nav-seen:v1";

function seenStorageKey(userId: string, section: NavBadgeKey): string {
  return `${SEEN_STORAGE_PREFIX}:${userId}:${section}`;
}

export function readNavSectionSeenAt(
  userId: string,
  section: NavBadgeKey,
): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(seenStorageKey(userId, section));
    return raw && raw.trim() ? raw : null;
  } catch {
    return null;
  }
}

export function writeNavSectionSeenAt(
  userId: string,
  section: NavBadgeKey,
  isoTimestamp: string = new Date().toISOString(),
): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(seenStorageKey(userId, section), isoTimestamp);
  } catch {
    // private mode / quota
  }
}

export function markNavSectionsSeenForPath(
  userId: string,
  pathname: string,
): NavBadgeKey[] {
  const cleared: NavBadgeKey[] = [];
  if (!userId || !pathname) return cleared;

  for (const [section, matches] of Object.entries(SECTION_PATH_MATCHERS) as Array<
    [Exclude<NavBadgeKey, "messages" | "notifications">, (p: string) => boolean]
  >) {
    if (matches(pathname)) {
      writeNavSectionSeenAt(userId, section);
      cleared.push(section);
    }
  }
  return cleared;
}

const FIRST_VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Count items newer than last visit. On first visit, only count items from
 * the last 7 days so the badge is useful without flooding new accounts.
 */
export function countNewSinceSeen(
  items: Array<{ created_at?: string | null; published_at?: string | null }>,
  lastSeenIso: string | null,
): number {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const timestamps = items
    .map((item) => {
      const raw = item.published_at || item.created_at || "";
      const ms = Date.parse(raw);
      return Number.isFinite(ms) ? ms : 0;
    })
    .filter((ms) => ms > 0);

  if (timestamps.length === 0) return 0;

  if (!lastSeenIso) {
    const floor = Date.now() - FIRST_VISIT_WINDOW_MS;
    return timestamps.filter((ms) => ms > floor).length;
  }

  const seenMs = Date.parse(lastSeenIso);
  if (!Number.isFinite(seenMs)) {
    const floor = Date.now() - FIRST_VISIT_WINDOW_MS;
    return timestamps.filter((ms) => ms > floor).length;
  }

  return timestamps.filter((ms) => ms > seenMs).length;
}
