"use client";

import type { ComponentType } from "react";
import Link from "next/link";

import { shellNavClass, type ShellNavAccent } from "@/lib/workspace/design";
import { formatNavBadgeCount } from "@/lib/workspace/nav-badges";
import { cn } from "@/lib/utils";

export function ShellNavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  accent = "neutral",
  badge = 0,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  accent?: ShellNavAccent;
  /** Unread / new item count shown as a pill on the right. */
  badge?: number;
}) {
  const iconTone =
    accent === "teal"
      ? active
        ? "text-teal-700"
        : "text-slate-400 group-hover:text-teal-600"
      : accent === "sky"
        ? active
          ? "text-sky-800"
          : "text-slate-400 group-hover:text-sky-700"
        : accent === "indigo"
          ? active
            ? "text-slate-800"
            : "text-slate-400 group-hover:text-slate-700"
          : active
            ? "text-slate-700"
            : "text-slate-400";

  const badgeLabel = formatNavBadgeCount(badge);
  const showBadge = Boolean(badgeLabel);
  const ariaLabel = showBadge ? `${label}, ${badge} new` : undefined;

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn("group", shellNavClass(active, accent))}
      aria-label={ariaLabel}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", iconTone)} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {showBadge ? (
        <span
          className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-slate-900 px-1.5 text-[10px] font-bold tabular-nums leading-none text-white"
          aria-hidden="true"
        >
          {badgeLabel}
        </span>
      ) : null}
    </Link>
  );
}
