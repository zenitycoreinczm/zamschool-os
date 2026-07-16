"use client";

import { cn } from "@/lib/utils";
import { ws } from "@/lib/workspace/design";

type WorkspaceLoaderProps = {
  label?: string;
  hint?: string;
  className?: string;
  compact?: boolean;
};

/**
 * Full-shell loading (workspace bootstrap, sign-out).
 * Uses brand mark + motion - not a raw spinner.
 */
export function WorkspaceLoader({
  label = "Preparing your workspace",
  hint = "This usually takes a moment",
  className,
  compact = false,
}: WorkspaceLoaderProps) {
  return (
    <div
      className={cn(
        "grid w-full place-items-center",
        compact ? "min-h-[50vh]" : "h-screen",
        ws.canvas,
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={cn(
          "flex flex-col items-center text-center animate-enter-up",
          compact ? "gap-3 px-4" : "gap-5 px-6",
        )}
      >
        <div
          className={cn(
            "overflow-hidden rounded-2xl bg-white shadow-workspace-md ring-1 ring-workspace-border",
            compact ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem]",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt=""
            width={compact ? 56 : 72}
            height={compact ? 56 : 72}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="space-y-1.5">
          <p
            className={cn(
              "font-semibold tracking-tight text-slate-800",
              compact ? "text-sm" : "text-base",
            )}
          >
            {label}
          </p>
          {hint ? (
            <p className="text-xs text-workspace-muted">{hint}</p>
          ) : null}
        </div>

        {/* Single loading motion: three bouncing dots */}
        <div className="flex items-end gap-1.5 py-0.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="workspace-loader-dot h-2 w-2 rounded-full bg-slate-500"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
