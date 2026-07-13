"use client";

import { splitAcademicContextLabel } from "@/lib/live-schema-adapters";
import { cn } from "@/lib/utils";

type AcademicContextLabelProps = {
  value?: string | null;
  className?: string;
  /** Extra classes for the year (primary) segment. */
  yearClassName?: string;
  /** Extra classes for the term (secondary, smaller) segment. */
  termClassName?: string;
  fallback?: string;
};

/**
 * Renders academic context as "2026" + small "Term 2".
 * Avoids legacy "2026 - 2" presentation.
 */
export function AcademicContextLabel({
  value,
  className,
  yearClassName,
  termClassName,
  fallback = "Academic Context",
}: AcademicContextLabelProps) {
  const raw = String(value || "").trim() || fallback;
  const { year, term } = splitAcademicContextLabel(raw);

  if (!term) {
    return (
      <span className={cn("truncate", className, yearClassName)}>
        {year || fallback}
      </span>
    );
  }

  if (!year) {
    return (
      <span
        className={cn(
          "truncate text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400",
          className,
          termClassName,
        )}
      >
        {term}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-baseline gap-1.5", className)}>
      <span className={cn("truncate font-semibold text-inherit", yearClassName)}>
        {year}
      </span>
      <span
        className={cn(
          "shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400",
          termClassName,
        )}
      >
        {term}
      </span>
    </span>
  );
}
