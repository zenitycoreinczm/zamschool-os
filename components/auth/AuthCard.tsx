import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthCardProps = {
  children: ReactNode;
  className?: string;
  /** Max width of the outer wrapper; defaults to the standard 440px auth width. */
  widthClassName?: string;
};

/**
 * Shared surface for auth flows (login, register, reset, verify, invites).
 * Renders the width wrapper + elevated card so every auth page stays visually
 * identical without repeating arbitrary radius/shadow values.
 */
export function AuthCard({
  children,
  className,
  widthClassName = "max-w-[440px]",
}: AuthCardProps) {
  return (
    <section className={cn("w-full", widthClassName)}>
      <div
        className={cn(
          "rounded-workspace-2xl border border-slate-200 bg-white p-6 shadow-workspace-xl",
          className,
        )}
      >
        {children}
      </div>
    </section>
  );
}
