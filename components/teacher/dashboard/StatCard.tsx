import Link from "next/link";
import { cn } from "@/lib/utils";

// Single accent family - avoid rainbow stats across the teacher portal.
const statTone = {
  sky: "bg-slate-700",
  violet: "bg-slate-600",
  amber: "bg-slate-500",
  emerald: "bg-slate-700",
  rose: "bg-slate-600",
} as const;

export type StatTone = keyof typeof statTone;

export function StatCard({
  label,
  value,
  hint,
  tone,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** @deprecated Decorative icons removed */
  icon?: React.ComponentType<{ className?: string }>;
  tone: StatTone;
  href?: string;
}) {
  const body = (
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div
        className={cn("mb-3 h-1 w-8 rounded-full", statTone[tone])}
        aria-hidden
      />
      <p className="ws-tabular text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
  if (href) {
    return <Link href={href}>{body}</Link>;
  }
  return body;
}
