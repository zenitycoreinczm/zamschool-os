import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SkeletonProps = {
  className?: string;
  /** Rounded pill / circle */
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
};

const roundedClass = {
  sm: "rounded-workspace-sm",
  md: "rounded-workspace-md",
  lg: "rounded-workspace-lg",
  xl: "rounded-workspace-xl",
  "2xl": "rounded-workspace-2xl",
  full: "rounded-full",
} as const;

/** Shimmer bone for custom skeletons. */
export function Skeleton({ className, rounded = "lg" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "workspace-skeleton",
        roundedClass[rounded],
        className,
      )}
      aria-hidden
    />
  );
}

/** White card shell with shimmer fill — matches workspace surfaces. */
export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "workspace-skeleton-block overflow-hidden rounded-workspace-xl",
        className,
      )}
      aria-hidden
    >
      {children ?? <div className="workspace-skeleton h-full min-h-[5rem] w-full" />}
    </div>
  );
}
