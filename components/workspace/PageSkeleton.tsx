import { cn } from "@/lib/utils";
import { Skeleton, SkeletonCard } from "@/components/workspace/Skeleton";

export type PageSkeletonVariant =
  | "dashboard"
  | "list"
  | "detail"
  | "form"
  | "split";

type PageSkeletonProps = {
  variant?: PageSkeletonVariant;
  className?: string;
  label?: string;
};

/**
 * Route-level skeleton layouts. Prefer these over full-screen spinners
 * once the shell is already painted — feels faster and keeps structure.
 */
export function PageSkeleton({
  variant = "dashboard",
  className,
  label = "Loading page",
}: PageSkeletonProps) {
  return (
    <div
      className={cn("animate-enter-up space-y-5 py-1", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      {variant === "dashboard" ? <DashboardSkeleton /> : null}
      {variant === "list" ? <ListSkeleton /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
      {variant === "form" ? <FormSkeleton /> : null}
      {variant === "split" ? <SplitSkeleton /> : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <SkeletonCard className="h-28 sm:h-32" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24 p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-20" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </SkeletonCard>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SkeletonCard className="h-64 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-[85%]" />
            <Skeleton className="mt-6 h-36 w-full" />
          </SkeletonCard>
          <SkeletonCard className="h-48 p-5">
            <Skeleton className="h-4 w-32" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </SkeletonCard>
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-40 p-5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-[80%]" />
          </SkeletonCard>
          <SkeletonCard className="h-56 p-5">
            <Skeleton className="h-4 w-36" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </SkeletonCard>
        </div>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <SkeletonCard className="h-28 sm:h-32" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-48 rounded-workspace-xl" />
        <Skeleton className="h-10 w-28 rounded-workspace-xl" />
        <Skeleton className="ml-auto h-10 w-32 rounded-workspace-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-40 max-w-[40%]" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-[80%]" />
              </div>
              <Skeleton className="h-8 w-16 shrink-0 rounded-workspace-lg" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <>
      <SkeletonCard className="h-32 sm:h-36" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} className="h-24 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-6 w-16" />
          </SkeletonCard>
        ))}
      </div>
      <SkeletonCard className="p-5 sm:p-6">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
          <Skeleton className="h-3 w-[60%]" />
        </div>
      </SkeletonCard>
    </>
  );
}

function FormSkeleton() {
  return (
    <>
      <SkeletonCard className="h-28" />
      <SkeletonCard className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-10 w-full rounded-workspace-xl" />
            </div>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Skeleton className="h-10 w-24 rounded-workspace-xl" />
          <Skeleton className="h-10 w-28 rounded-workspace-xl" />
        </div>
      </SkeletonCard>
    </>
  );
}

function SplitSkeleton() {
  return (
    <>
      <SkeletonCard className="h-28 sm:h-32" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <SkeletonCard className="min-h-[20rem] p-5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="mt-4 h-64 w-full" />
        </SkeletonCard>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-24 p-4">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-full" />
              <Skeleton className="mt-1.5 h-3 w-[80%]" />
            </SkeletonCard>
          ))}
        </div>
      </div>
    </>
  );
}
