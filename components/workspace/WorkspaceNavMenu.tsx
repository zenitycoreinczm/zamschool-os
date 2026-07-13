"use client";

import { ShellNavItem } from "@/components/workspace/ShellNavItem";
import type { WorkspaceNavSection } from "@/lib/workspace/nav";
import { ws, type ShellNavAccent } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

type WorkspaceNavMenuProps = {
  sections: WorkspaceNavSection[];
  activePaths: Set<string>;
  onNavigate?: () => void;
  accent?: ShellNavAccent;
  /** Map of nav href → unread/new count for badge display. */
  badgeByHref?: Record<string, number>;
};

export function WorkspaceNavMenu({
  sections,
  activePaths,
  onNavigate,
  accent = "neutral",
  badgeByHref,
}: WorkspaceNavMenuProps) {
  return (
    <div className="space-y-4">
      {sections.map((section, index) => (
        <div key={`${section.label}-${index}`}>
          <p
            className={cn(
              "px-3 pb-2",
              index === 0 ? "pt-0" : "pt-1",
              ws.eyebrow,
            )}
          >
            {section.label}
          </p>
          <div className="space-y-1">
            {dedupeSectionItems(section.items).map((item) => (
              <ShellNavItem
                key={`${section.label}-${item.href}`}
                {...item}
                active={activePaths.has(item.href)}
                onNavigate={onNavigate}
                accent={accent}
                badge={badgeByHref?.[item.href] ?? 0}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function dedupeSectionItems<T extends { href: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}
