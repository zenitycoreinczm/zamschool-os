"use client";

import type { ComponentType } from "react";

import { Surface } from "@/components/workspace/Surface";
import type { HeroAccent } from "@/components/workspace/heroAccents";

export function ProfileSummaryField({
  label,
  value,
}: {
  /** @deprecated Decorative icons removed */
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: HeroAccent;
}) {
  return (
    <Surface variant="default" className="p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-medium text-slate-900">{value}</p>
    </Surface>
  );
}
