"use client";

import type { ComponentType, ReactNode } from "react";

import { heroAccentStyles, type HeroAccent } from "@/components/workspace/heroAccents";
import { cn } from "@/lib/utils";

export type AdminStatCard = {
  label: string;
  value: string | number;
  hint?: string;
  /** @deprecated Decorative icons removed from hero stats */
  icon?: ComponentType<{ className?: string }>;
  tone?: "sky" | "violet" | "amber" | "emerald" | "slate";
};

type AdminPageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  stats?: AdminStatCard[];
  actions?: ReactNode;
  accent?: HeroAccent;
};

export function AdminPageHero({
  eyebrow,
  title,
  description,
  stats,
  actions,
  /** @deprecated Staff chrome is monochrome slate; accent no longer changes the hero. */
  accent: _accent = "slate",
}: AdminPageHeroProps) {
  void _accent;
  // One workspace chrome for every desk / module (no rainbow heroes).
  const palette = heroAccentStyles.slate;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-workspace-2xl border border-slate-800/40 bg-gradient-to-br text-white shadow-workspace-md",
        palette.shell
      )}
    >
      <div
        className={cn("pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full blur-3xl", palette.glowA)}
        aria-hidden
      />
      <div
        className={cn("pointer-events-none absolute -bottom-28 right-[-2rem] h-72 w-72 rounded-full blur-3xl", palette.glowB)}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 p-4 md:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <p className={cn("ws-eyebrow", palette.eyebrow)}>{eyebrow}</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-[1.65rem] lg:text-[1.75rem]">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-slate-300/95">{description}</p>
        </div>
        {actions ? (
          <div className="relative flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {stats && stats.length > 0 ? (
        <div className="relative grid grid-cols-2 gap-2 border-t border-white/10 bg-black/15 p-3 backdrop-blur-md md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={cn(
                "rounded-workspace-lg border px-3 py-2.5 backdrop-blur-sm transition-colors duration-[var(--duration-workspace-fast)] hover:bg-white/[0.08]",
                palette.statBorder,
                "bg-white/[0.04]",
              )}
            >
              <p className="ws-tabular text-lg font-bold leading-none">
                {stat.value}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-slate-200">
                {stat.label}
              </p>
              {stat.hint ? (
                <p className="mt-0.5 text-[11px] text-slate-400">{stat.hint}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
