import type { TabKey } from "./types";
import { TABS } from "./types";
import { cn } from "@/lib/utils";
import { surface } from "@/lib/workspace/design";

type UsersTabBarProps = {
  activeTab: TabKey;
  counts: { students: number; teachers: number; parents: number };
  onChange: (tab: TabKey) => void;
  /** Limit visible tabs (e.g. HR staff directory → teachers only). */
  visibleTabs?: TabKey[];
};

export function UsersTabBar({
  activeTab,
  counts,
  onChange,
  visibleTabs,
}: UsersTabBarProps) {
  const tabs = visibleTabs?.length
    ? TABS.filter((tab) => visibleTabs.includes(tab.key))
    : TABS;

  if (tabs.length <= 1) {
    // Single-tab consoles (HR) don't need a tab strip.
    return null;
  }

  return (
    <div className={cn(surface("default"), "rounded-workspace-2xl p-1.5")}>
      <div
        role="tablist"
        aria-label="User directory tabs"
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const active = tab.key === activeTab;
          const count =
            tab.key === "students"
              ? counts.students
              : tab.key === "teachers"
                ? counts.teachers
                : counts.parents;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`users-tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`users-panel-${tab.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-workspace-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 sm:px-4",
                active
                  ? "bg-slate-900 font-semibold text-white shadow-workspace-sm"
                  : "font-medium text-slate-600 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={cn(
                  "ws-tabular rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
