import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

import { AdminPageHero, type AdminStatCard } from "@/components/admin/AdminPageHero";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";

export function TeacherHero({
  eyebrow,
  title,
  description,
  stats,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats?: AdminStatCard[];
  actions?: ReactNode;
}) {
  return (
    <AdminPageHero
      eyebrow={eyebrow}
      title={title}
      description={description}
      stats={stats}
      actions={actions}
      accent="slate"
    />
  );
}

export function TeacherPageHeader({
  eyebrow,
  title,
  description,
  icon,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  icon?: ComponentType<LucideProps>;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      icon={icon}
      actions={actions}
      accent="slate"
    />
  );
}

export function TeacherCard({
  children,
  className,
  elevated = false,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  hover?: boolean;
}) {
  return (
    <Surface
      variant={elevated ? "elevated" : "default"}
      className={cn(
        "p-4 md:p-5 transition duration-150",
        hover && "hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300",
        className
      )}
    >
      {children}
    </Surface>
  );
}

const statToneStyles = {
  slate: { bar: "bg-slate-700", icon: "text-slate-600 bg-slate-100" },
  sky: { bar: "bg-sky-600", icon: "text-sky-700 bg-sky-50" },
  emerald: { bar: "bg-emerald-600", icon: "text-emerald-700 bg-emerald-50" },
  amber: { bar: "bg-amber-600", icon: "text-amber-800 bg-amber-50" },
  rose: { bar: "bg-rose-600", icon: "text-rose-700 bg-rose-50" },
} as const;

export function TeacherStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  tone?: "slate" | "sky" | "emerald" | "amber" | "rose";
}) {
  const styles = statToneStyles[tone] || statToneStyles.slate;
  return (
    <TeacherCard hover className="relative overflow-hidden">
      <div className={cn("absolute left-0 top-0 h-1 w-full", styles.bar)} aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ws-tabular text-2xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-700">{label}</p>
          {hint ? (
            <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </TeacherCard>
  );
}

export function TeacherEmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Surface
      variant="dashed"
      className="grid place-items-center px-6 py-14 text-center"
    >
      {Icon ? (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-workspace-muted">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Surface>
  );
}

export const teacherInputClass =
  "w-full rounded-workspace-lg border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-workspace-xs outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 placeholder:text-slate-400";

export const teacherPillClass =
  "rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-workspace-xs";
