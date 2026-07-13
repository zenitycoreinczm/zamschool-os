export type HeroAccent =
  | "sky"
  | "teal"
  | "indigo"
  | "amber"
  | "emerald"
  | "violet"
  | "rose"
  | "slate"
  | "green";

export const heroAccentStyles: Record<
  HeroAccent,
  {
    shell: string;
    eyebrow: string;
    glowA: string;
    glowB: string;
    statBorder: string;
  }
> = {
  sky: {
    shell: "from-slate-950 via-slate-900 to-sky-950",
    eyebrow: "text-sky-300",
    glowA: "bg-sky-500/25",
    glowB: "bg-cyan-400/15",
    statBorder: "border-white/10",
  },
  teal: {
    shell: "from-slate-950 via-teal-950 to-emerald-950",
    eyebrow: "text-teal-300",
    glowA: "bg-teal-500/30",
    glowB: "bg-emerald-400/15",
    statBorder: "border-white/10",
  },
  indigo: {
    shell: "from-slate-950 via-indigo-950 to-violet-950",
    eyebrow: "text-indigo-300",
    glowA: "bg-indigo-500/30",
    glowB: "bg-violet-400/15",
    statBorder: "border-white/10",
  },
  amber: {
    shell: "from-slate-950 via-amber-950 to-orange-950",
    eyebrow: "text-amber-300",
    glowA: "bg-amber-500/25",
    glowB: "bg-orange-400/15",
    statBorder: "border-white/10",
  },
  emerald: {
    shell: "from-slate-950 via-emerald-950 to-teal-950",
    eyebrow: "text-emerald-300",
    glowA: "bg-emerald-500/25",
    glowB: "bg-teal-400/15",
    statBorder: "border-white/10",
  },
  violet: {
    shell: "from-slate-950 via-violet-950 to-fuchsia-950",
    eyebrow: "text-violet-300",
    glowA: "bg-violet-500/25",
    glowB: "bg-fuchsia-400/15",
    statBorder: "border-white/10",
  },
  rose: {
    shell: "from-slate-950 via-rose-950 to-pink-950",
    eyebrow: "text-rose-300",
    glowA: "bg-rose-500/25",
    glowB: "bg-pink-400/15",
    statBorder: "border-white/10",
  },
  slate: {
    shell: "from-slate-950 via-slate-900 to-slate-800",
    eyebrow: "text-slate-300",
    glowA: "bg-slate-500/20",
    glowB: "bg-slate-400/10",
    statBorder: "border-white/10",
  },
  green: {
    shell: "from-slate-950 via-green-950 to-emerald-950",
    eyebrow: "text-green-300",
    glowA: "bg-green-500/25",
    glowB: "bg-emerald-400/15",
    statBorder: "border-white/10",
  },
};

export const pageHeaderAccentStyles: Record<
  HeroAccent,
  { bar: string; eyebrow: string; surface: string; icon: string }
> = {
  sky: {
    bar: "from-sky-500 to-cyan-400",
    eyebrow: "text-sky-600",
    surface: "from-white via-white to-sky-50/80",
    icon: "bg-sky-50 text-sky-600 ring-sky-100",
  },
  teal: {
    bar: "from-teal-500 to-emerald-400",
    eyebrow: "text-teal-600",
    surface: "from-white via-white to-teal-50/80",
    icon: "bg-teal-50 text-teal-600 ring-teal-100",
  },
  indigo: {
    bar: "from-indigo-500 to-violet-400",
    eyebrow: "text-indigo-600",
    surface: "from-white via-white to-indigo-50/80",
    icon: "bg-indigo-50 text-indigo-600 ring-indigo-100",
  },
  amber: {
    bar: "from-amber-500 to-orange-400",
    eyebrow: "text-amber-700",
    surface: "from-white via-white to-amber-50/80",
    icon: "bg-amber-50 text-amber-600 ring-amber-100",
  },
  emerald: {
    bar: "from-emerald-500 to-teal-400",
    eyebrow: "text-emerald-600",
    surface: "from-white via-white to-emerald-50/80",
    icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  },
  violet: {
    bar: "from-violet-500 to-fuchsia-400",
    eyebrow: "text-violet-600",
    surface: "from-white via-white to-violet-50/80",
    icon: "bg-violet-50 text-violet-600 ring-violet-100",
  },
  rose: {
    bar: "from-rose-500 to-pink-400",
    eyebrow: "text-rose-600",
    surface: "from-white via-white to-rose-50/80",
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
  },
  slate: {
    bar: "from-slate-600 to-slate-400",
    eyebrow: "text-slate-600",
    surface: "from-white via-white to-slate-50",
    icon: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  green: {
    bar: "from-green-500 to-emerald-400",
    eyebrow: "text-green-600",
    surface: "from-white via-white to-green-50/80",
    icon: "bg-green-50 text-green-600 ring-green-100",
  },
};

export const panelAccentStyles: Record<
  HeroAccent,
  {
    surfaceBorder: string;
    subBg: string;
    subText: string;
    chip: string;
    chipBorder: string;
    chipHover: string;
    dismissBorder: string;
    dismissBg: string;
    dismissText: string;
    dismissHoverBg: string;
    dismissHoverText: string;
  }
> = {
  sky: {
    surfaceBorder: "border-sky-200",
    subBg: "bg-sky-50/60",
    subText: "text-sky-700",
    chip: "bg-white",
    chipBorder: "border-sky-200",
    chipHover: "hover:bg-sky-50",
    dismissBorder: "border-sky-200",
    dismissBg: "bg-white",
    dismissText: "text-sky-800",
    dismissHoverBg: "hover:bg-sky-50",
    dismissHoverText: "hover:text-sky-900",
  },
  teal: {
    surfaceBorder: "border-teal-200",
    subBg: "bg-teal-50/60",
    subText: "text-teal-700",
    chip: "bg-white",
    chipBorder: "border-teal-200",
    chipHover: "hover:bg-teal-50",
    dismissBorder: "border-teal-200",
    dismissBg: "bg-white",
    dismissText: "text-teal-800",
    dismissHoverBg: "hover:bg-teal-50",
    dismissHoverText: "hover:text-teal-900",
  },
  indigo: {
    surfaceBorder: "border-indigo-200",
    subBg: "bg-indigo-50/60",
    subText: "text-indigo-700",
    chip: "bg-white",
    chipBorder: "border-indigo-200",
    chipHover: "hover:bg-indigo-50",
    dismissBorder: "border-indigo-200",
    dismissBg: "bg-white",
    dismissText: "text-indigo-800",
    dismissHoverBg: "hover:bg-indigo-50",
    dismissHoverText: "hover:text-indigo-900",
  },
  amber: {
    surfaceBorder: "border-amber-200",
    subBg: "bg-amber-50/60",
    subText: "text-amber-700",
    chip: "bg-white",
    chipBorder: "border-amber-200",
    chipHover: "hover:bg-amber-50",
    dismissBorder: "border-amber-200",
    dismissBg: "bg-white",
    dismissText: "text-amber-800",
    dismissHoverBg: "hover:bg-amber-50",
    dismissHoverText: "hover:text-amber-900",
  },
  emerald: {
    surfaceBorder: "border-emerald-200",
    subBg: "bg-emerald-50/60",
    subText: "text-emerald-700",
    chip: "bg-white",
    chipBorder: "border-emerald-200",
    chipHover: "hover:bg-emerald-50",
    dismissBorder: "border-emerald-200",
    dismissBg: "bg-white",
    dismissText: "text-emerald-800",
    dismissHoverBg: "hover:bg-emerald-50",
    dismissHoverText: "hover:text-emerald-900",
  },
  violet: {
    surfaceBorder: "border-violet-200",
    subBg: "bg-violet-50/60",
    subText: "text-violet-700",
    chip: "bg-white",
    chipBorder: "border-violet-200",
    chipHover: "hover:bg-violet-50",
    dismissBorder: "border-violet-200",
    dismissBg: "bg-white",
    dismissText: "text-violet-800",
    dismissHoverBg: "hover:bg-violet-50",
    dismissHoverText: "hover:text-violet-900",
  },
  rose: {
    surfaceBorder: "border-rose-200",
    subBg: "bg-rose-50/60",
    subText: "text-rose-700",
    chip: "bg-white",
    chipBorder: "border-rose-200",
    chipHover: "hover:bg-rose-50",
    dismissBorder: "border-rose-200",
    dismissBg: "bg-white",
    dismissText: "text-rose-800",
    dismissHoverBg: "hover:bg-rose-50",
    dismissHoverText: "hover:text-rose-900",
  },
  slate: {
    surfaceBorder: "border-slate-200",
    subBg: "bg-slate-50/60",
    subText: "text-slate-600",
    chip: "bg-white",
    chipBorder: "border-slate-200",
    chipHover: "hover:bg-slate-50",
    dismissBorder: "border-slate-200",
    dismissBg: "bg-white",
    dismissText: "text-slate-700",
    dismissHoverBg: "hover:bg-slate-50",
    dismissHoverText: "hover:text-slate-800",
  },
  green: {
    surfaceBorder: "border-green-200",
    subBg: "bg-green-50/60",
    subText: "text-green-700",
    chip: "bg-white",
    chipBorder: "border-green-200",
    chipHover: "hover:bg-green-50",
    dismissBorder: "border-green-200",
    dismissBg: "bg-white",
    dismissText: "text-green-800",
    dismissHoverBg: "hover:bg-green-50",
    dismissHoverText: "hover:text-green-900",
  },
};

export function moduleToneClass(tone: string) {
  // Prefer monochrome staff UI; keep named tones soft if still referenced.
  switch (tone) {
    case "emerald":
    case "indigo":
    case "amber":
    case "rose":
    case "violet":
    case "teal":
    case "green":
    case "sky":
    case "slate":
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200 group-hover:bg-slate-200";
  }
}
