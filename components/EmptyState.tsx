"use client";

import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";

import { Surface } from "@/components/workspace/Surface";
import { primaryButton } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <Surface variant="dashed" className={cn("flex flex-col items-center px-8 py-12 text-center", className)}>
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 ring-1 ring-workspace-border">
        <Icon className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-workspace-muted">{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className={cn(primaryButton(), "mt-8")}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </button>
      ) : null}
    </Surface>
  );
}