import { cn } from "@/lib/utils";

type Tone = "emerald" | "rose" | "amber" | "sky";

const toneStyles: Record<
  Tone,
  { bar: string; soft: string; value: string }
> = {
  emerald: {
    bar: "bg-emerald-500",
    soft: "from-emerald-50/80 to-white",
    value: "text-emerald-900",
  },
  rose: {
    bar: "bg-rose-500",
    soft: "from-rose-50/80 to-white",
    value: "text-rose-900",
  },
  amber: {
    bar: "bg-amber-500",
    soft: "from-amber-50/80 to-white",
    value: "text-amber-900",
  },
  sky: {
    bar: "bg-sky-500",
    soft: "from-sky-50/80 to-white",
    value: "text-sky-900",
  },
};

export function StudentStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** @deprecated Decorative icons removed — kept optional for call-site compatibility */
  icon?: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  const styles = toneStyles[tone];
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-gradient-to-b p-4 shadow-sm sm:rounded-3xl sm:p-5",
        styles.soft,
      )}
    >
      <div
        className={cn("mb-3 h-1 w-7 rounded-full", styles.bar)}
        aria-hidden
      />
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl",
          styles.value,
        )}
      >
        {value}
      </p>
    </div>
  );
}
