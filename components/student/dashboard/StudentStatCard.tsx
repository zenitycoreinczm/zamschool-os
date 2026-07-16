import { cn } from "@/lib/utils";

/** Kept for call-site compatibility; cards are now a single neutral palette. */
type Tone = "emerald" | "rose" | "amber" | "sky" | "neutral";

export function StudentStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
  /** @deprecated Decorative icons removed - kept optional for call-site compatibility */
  icon?: React.ComponentType<{ className?: string }>;
  /** @deprecated Multi-tone cards removed - ignored for a calmer single palette */
  tone?: Tone;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5",
      )}
    >
      <p className="text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
