"use client";

import type { ComponentType } from "react";
import Link from "next/link";

import { shellNavClass } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

type ShellNavAccent = "neutral" | "teal" | "indigo";

export function ShellNavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  accent = "neutral",
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  onNavigate?: () => void;
  accent?: ShellNavAccent;
}) {
  const iconTone =
    accent === "teal"
      ? active
        ? "text-teal-700"
        : "text-slate-400 group-hover:text-teal-600"
      : accent === "indigo"
        ? active
          ? "text-indigo-700"
          : "text-slate-400 group-hover:text-indigo-600"
        : active
          ? "text-slate-700"
          : "text-slate-400";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn("group", shellNavClass(active, accent))}
    >
      <Icon className={cn("h-4 w-4 shrink-0 transition-colors", iconTone)} />
      <span>{label}</span>
    </Link>
  );
}