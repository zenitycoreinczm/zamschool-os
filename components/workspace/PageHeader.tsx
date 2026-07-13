import type { ReactNode } from "react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";

import {
  pageHeaderAccentStyles,
  type HeroAccent,
} from "@/components/workspace/heroAccents";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  accent?: HeroAccent;
  /** @deprecated Decorative icons removed from page headers */
  icon?: ComponentType<LucideProps>;
};

/** Light subpage header for shared app modules (announcements, settings, etc.). */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  /** @deprecated Staff chrome is monochrome slate; accent no longer changes the header. */
  accent: _accent = "slate",
}: PageHeaderProps) {
  void _accent;
  // One light subpage header for every module (classes, subjects, timetable, settings…).
  const palette = pageHeaderAccentStyles.slate;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-workspace-xl border border-workspace-border bg-gradient-to-br p-5 shadow-workspace-sm sm:flex sm:items-start sm:justify-between sm:gap-4",
        palette.surface,
      )}
    >
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1 bg-gradient-to-b",
          palette.bar,
        )}
        aria-hidden
      />
      <div className="relative min-w-0 pl-3">
        <p className={cn("ws-eyebrow", palette.eyebrow)}>{eyebrow}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 md:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-workspace-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="relative mt-4 flex shrink-0 flex-wrap items-center gap-2 sm:mt-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
