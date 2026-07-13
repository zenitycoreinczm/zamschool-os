"use client";

import { useEffect, useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { ws } from "@/lib/workspace/design";

type UsersModalShellProps = {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  /** max width: sm | md | lg | xl | 2xl | 3xl | 5xl */
  size?: "md" | "lg" | "xl" | "2xl" | "3xl" | "5xl";
  className?: string;
  bodyClassName?: string;
  /** When true, allow vertical scroll of the whole overlay (long forms). */
  scrollableOverlay?: boolean;
};

const sizeClass: Record<NonNullable<UsersModalShellProps["size"]>, string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
};

export function UsersModalShell({
  title,
  description,
  onClose,
  children,
  footer,
  headerActions,
  size = "xl",
  className,
  bodyClassName,
  scrollableOverlay = false,
}: UsersModalShellProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 p-4",
        ws.overlay,
        scrollableOverlay
          ? "overflow-y-auto"
          : "grid place-items-center",
      )}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          scrollableOverlay &&
            "mx-auto flex min-h-full w-full items-start justify-center py-4 sm:items-center",
        )}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "w-full overflow-hidden rounded-workspace-2xl border border-workspace-border bg-white shadow-workspace-lg",
            sizeClass[size],
            scrollableOverlay && "max-h-[92vh] flex flex-col",
            !scrollableOverlay && "max-h-[90vh] flex flex-col",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-workspace-border bg-slate-50/80 px-5 py-4 sm:px-6">
            <div className="min-w-0 space-y-1">
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="max-w-2xl text-sm leading-relaxed text-workspace-muted"
                >
                  {description}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="grid h-9 w-9 place-items-center rounded-workspace-lg border border-workspace-border bg-white text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6",
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-workspace-border bg-white px-5 py-4 sm:px-6">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
