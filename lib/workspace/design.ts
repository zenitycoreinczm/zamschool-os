import { cn } from "@/lib/utils";

/** Canonical workspace layout and surface classes — use instead of hard-coded hex values. */
export const ws = {
  canvas: "bg-workspace-canvas text-workspace-foreground",
  sidebar: "bg-workspace-sidebar border-workspace-border",
  header: "zamschool-workspace-shell__header bg-workspace-canvas/95 backdrop-blur-sm",
  headerActions: "relative overflow-visible",
  popover: "zamschool-workspace-popover",
  mainScroll: "zamschool-workspace-main-scroll",
  overlay: "bg-slate-900/20 backdrop-blur-[2px]",
  eyebrow: "ws-eyebrow text-workspace-muted",
  tabular: "ws-tabular",
} as const;

export type SurfaceVariant = "default" | "elevated" | "inset" | "dashed" | "ghost";

const surfaceVariants: Record<SurfaceVariant, string> = {
  default:
    "rounded-workspace-xl border border-workspace-border bg-white shadow-workspace-sm",
  elevated:
    "rounded-workspace-xl border border-workspace-border bg-white shadow-workspace-md",
  inset:
    "rounded-workspace-lg border border-workspace-border bg-slate-50/80",
  dashed:
    "rounded-workspace-xl border border-dashed border-workspace-border-strong bg-white/80",
  ghost: "rounded-workspace-lg bg-transparent",
};

export function surface(variant: SurfaceVariant = "default", className?: string) {
  return cn(surfaceVariants[variant], className);
}

export function shellNavClass(active: boolean, accent: "neutral" | "teal" | "indigo" = "neutral") {
  const activeAccent =
    accent === "teal"
      ? "bg-teal-50 text-teal-900 shadow-workspace-xs ring-1 ring-teal-200/80"
      : accent === "indigo"
        ? "bg-indigo-50 text-indigo-900 shadow-workspace-xs ring-1 ring-indigo-200/80"
        : "bg-white text-slate-800 shadow-workspace-xs ring-1 ring-workspace-border";

  const idleAccent =
    accent === "teal"
      ? "text-slate-500 hover:bg-teal-50/60 hover:text-teal-900"
      : accent === "indigo"
        ? "text-slate-500 hover:bg-indigo-50/60 hover:text-indigo-900"
        : "text-slate-500 hover:bg-white/80 hover:text-slate-800";

  return cn(
    "flex items-center gap-3 rounded-workspace-lg px-2.5 py-2 text-sm font-medium transition-all duration-[var(--duration-workspace-normal)] ease-[var(--ease-workspace-out)]",
    active ? activeAccent : idleAccent
  );
}

export function primaryButton(className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-workspace-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-workspace-sm transition-all duration-[var(--duration-workspace-fast)] hover:bg-brand-hover focus-visible:shadow-workspace-focus disabled:pointer-events-none disabled:opacity-50",
    className
  );
}

export function secondaryButton(className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-workspace-lg border border-workspace-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-workspace-xs transition-all duration-[var(--duration-workspace-fast)] hover:border-slate-300 hover:bg-slate-50 focus-visible:shadow-workspace-focus disabled:opacity-50",
    className
  );
}

export const roleStatSurface: Record<"admin" | "teacher" | "student" | "parent", string> = {
  admin: "from-indigo-100/90 via-indigo-50 to-white border-indigo-200/70",
  teacher: "from-amber-100/90 via-amber-50 to-white border-amber-200/70",
  student: "from-violet-100/90 via-violet-50 to-white border-violet-200/70",
  parent: "from-orange-100/90 via-orange-50 to-white border-orange-200/70",
};
