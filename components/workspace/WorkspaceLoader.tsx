"use client";

import { cn } from "@/lib/utils";
import { ws } from "@/lib/workspace/design";

type WorkspaceLoaderProps = {
  label?: string;
  className?: string;
  compact?: boolean;
};

export function WorkspaceLoader({
  label = "Preparing your workspace",
  className,
  compact = false,
}: WorkspaceLoaderProps) {
  return (
    <div
      className={cn(
        "grid h-screen w-full place-items-center",
        ws.canvas,
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className={cn("flex flex-col items-center text-center", compact ? "gap-3" : "gap-5")}>
        <div className="relative">
          <div
            className="workspace-loader-ring absolute inset-0 rounded-full bg-sky-400/25"
            aria-hidden
          />
          <div
            className={cn(
              "relative overflow-hidden rounded-full bg-white shadow-workspace-md ring-1 ring-workspace-border",
              compact ? "h-12 w-12" : "h-16 w-16"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              width={compact ? 48 : 64}
              height={compact ? 48 : 64}
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className={cn("font-semibold text-slate-800", compact ? "text-sm" : "text-base")}>
            {label}
          </p>
          <p className="text-xs text-workspace-muted">This usually takes a moment</p>
        </div>
        <div className="flex items-end gap-1.5 py-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="workspace-loader-dot h-2 w-2 rounded-full bg-sky-500"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}