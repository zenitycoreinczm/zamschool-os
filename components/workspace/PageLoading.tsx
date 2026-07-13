import { cn } from "@/lib/utils";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import {
  PageSkeleton,
  type PageSkeletonVariant,
} from "@/components/workspace/PageSkeleton";

type PageLoadingProps = {
  label?: string;
  accent?: HeroAccent;
  /**
   * `brand` — compact branded loader (default, for in-page waits).
   * `skeleton` — structural page skeleton (preferred once shell is ready).
   */
  mode?: "brand" | "skeleton";
  skeletonVariant?: PageSkeletonVariant;
  className?: string;
};

/**
 * In-page loading. Prefer `mode="skeleton"` on full pages so layout
 * does not jump; use brand mode for modals / short waits.
 * Loader dots are always slate so page chrome stays consistent.
 */
export function PageLoading({
  label = "Loading",
  accent: _accent = "slate",
  mode = "brand",
  skeletonVariant = "list",
  className,
}: PageLoadingProps) {
  void _accent;

  if (mode === "skeleton") {
    return (
      <PageSkeleton
        variant={skeletonVariant}
        label={label}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-[42vh] place-items-center px-4",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex max-w-xs flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-workspace-md ring-1 ring-workspace-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 object-cover"
          />
        </div>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-1 text-xs text-workspace-muted">Almost ready…</p>
        {/* Single loading motion: three bouncing dots (slate only) */}
        <div className="mt-4 flex items-end gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="workspace-loader-dot h-1.5 w-1.5 rounded-full bg-slate-500"
              style={{ animationDelay: `${i * 0.16}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
