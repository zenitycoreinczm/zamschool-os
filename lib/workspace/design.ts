import { cn } from "@/lib/utils";

/** Canonical workspace layout and surface classes - use instead of hard-coded hex values. */
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

export type ShellNavAccent = "neutral" | "teal" | "sky" | "indigo" | "slate";

export function shellNavClass(
  active: boolean,
  _accent: ShellNavAccent = "neutral",
) {
  void _accent;
  // Monochrome staff nav - one active style everywhere (no sky/teal/indigo variants).
  return cn(
    "flex items-center gap-3 rounded-workspace-lg px-2.5 py-2 text-sm font-medium transition-all duration-[var(--duration-workspace-normal)] ease-[var(--ease-workspace-out)]",
    // Allow badge pills to sit flush on the right without shrinking the label.
    "pr-2",
    active
      ? "bg-white text-slate-800 shadow-workspace-xs ring-1 ring-workspace-border"
      : "text-slate-500 hover:bg-white/80 hover:text-slate-800",
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

/** Canonical in-page spinner color - use instead of sky/amber/emerald spinners. */
export const spinnerClass = "h-5 w-5 animate-spin text-slate-500";

export const roleStatSurface: Record<"admin" | "teacher" | "student" | "parent", string> = {
  admin: "from-slate-100 via-slate-50 to-white border-slate-200/80",
  teacher: "from-slate-100 via-white to-white border-slate-200/80",
  student: "from-slate-100 via-white to-white border-slate-200/80",
  parent: "from-slate-100 via-white to-white border-slate-200/80",
};
