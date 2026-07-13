import Link from "next/link";
import type { WorkspaceNavItem } from "@/lib/workspace/nav";
import { formatNavBadgeCount } from "@/lib/workspace/nav-badges";

type MobileDockProps = {
  pathname: string;
  items: WorkspaceNavItem[];
  onClose: () => void;
  /** @deprecated Dock chrome is monochrome; accent is ignored. */
  activeAccent?: "sky" | "teal" | "green" | "neutral" | "slate";
  columns?: 4 | 5;
  isActive?: (pathname: string, href: string) => boolean;
  /** Map of nav href → unread/new count for badge display. */
  badgeByHref?: Record<string, number>;
};

export function MobileDock({
  pathname,
  items,
  onClose,
  activeAccent: _activeAccent = "neutral",
  columns = 5,
  isActive,
  badgeByHref,
}: MobileDockProps) {
  void _activeAccent;
  const checkActive = isActive ?? defaultIsActive;
  const activeClass = "bg-slate-100 text-slate-900";

  const gridClass = columns === 4 ? "grid-cols-4" : "grid-cols-5";
  const visibleItems = dedupeDockItems(items);

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white px-2 py-2"
    >
      <div className={`grid ${gridClass} gap-1`}>
        {visibleItems.map((item) => {
          const active = checkActive(pathname, item.href);
          const badge = badgeByHref?.[item.href] ?? 0;
          const badgeLabel = formatNavBadgeCount(badge);
          const showBadge = Boolean(badgeLabel);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`relative flex flex-col items-center justify-center rounded-lg py-2 ${
                active ? activeClass : "text-slate-600"
              }`}
              aria-label={
                showBadge ? `${item.label}, ${badge} new` : item.label
              }
            >
              <span className="relative">
                <item.icon className="h-4.5 w-4.5" />
                {showBadge ? (
                  <span
                    className="absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-slate-900 px-1 text-[9px] font-bold tabular-nums text-white"
                    aria-hidden="true"
                  >
                    {badgeLabel}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function dedupeDockItems(items: WorkspaceNavItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

function defaultIsActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
