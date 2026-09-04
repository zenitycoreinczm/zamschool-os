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
  icon: Icon,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone: StatTone;
  href?: string;
}) {
  const body = (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300">
      <div
        className={cn("absolute left-0 top-0 h-1 w-full", statTone[tone])}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ws-tabular text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{label}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </div>
  );
  if (href) {
    return <Link href={href}>{body}</Link>;
  }
  return body;
}
