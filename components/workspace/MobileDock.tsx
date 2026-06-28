import Link from "next/link";
import type { WorkspaceNavItem } from "@/lib/workspace/nav";

type MobileDockProps = {
  pathname: string;
  items: WorkspaceNavItem[];
  onClose: () => void;
  activeAccent?: "sky" | "teal" | "green";
  columns?: 4 | 5;
  isActive?: (pathname: string, href: string) => boolean;
};

const accentMap = {
  sky: "text-sky-600 bg-sky-50",
  teal: "text-teal-700 bg-teal-50",
  green: "text-green-600 bg-green-50",
} as const;

export function MobileDock({
  pathname,
  items,
  onClose,
  activeAccent = "sky",
  columns = 5,
  isActive,
}: MobileDockProps) {
  const checkActive = isActive ?? defaultIsActive;
  const activeClass = accentMap[activeAccent];

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
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex flex-col items-center justify-center rounded-lg py-2 ${
                active ? activeClass : "text-slate-500"
              }`}
            >
              <item.icon className="h-4.5 w-4.5" />
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
