/**
 * Shared primitives for role-scoped workspace dashboards.
 * Premium slate desk pattern — restrained colour, clear modules + workflow.
 */
import Link from "next/link";
import type { ComponentType } from "react";
import { ArrowRight } from "lucide-react";

export type WorkspaceModule = {
  href: string;
  title: string;
  description: string;
  /** @deprecated Decorative icons removed */
  icon?: ComponentType<{ className?: string }>;
  tone?: "sky" | "emerald" | "violet" | "amber" | "rose" | "slate" | "indigo";
};

export function WorkspaceDashboard({
  eyebrow,
  title,
  description,
  modules,
  workflow,
  primaryAction,
}: {
  eyebrow: string;
  title: string;
  description: string;
  /** @deprecated Prefer slate hero; gradient kept for API compatibility */
  gradient?: string;
  modules: WorkspaceModule[];
  workflow?: string[];
  primaryAction?: { href: string; label: string };
}) {
  return (
    <div className="space-y-5 p-4 pb-8 md:p-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white shadow-sm">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {eyebrow}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {description}
            </p>
          </div>
          {primaryAction ? (
            <Link
              href={primaryAction.href}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              {primaryAction.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ href, title: moduleTitle, description: moduleDesc }) => (
          <Link
            key={href + moduleTitle}
            href={href}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/50"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{moduleTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {moduleDesc}
              </p>
            </div>
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      {workflow && workflow.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">
            Workflow guide
          </h2>
          <ol className="mt-3 space-y-2">
            {workflow.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-sm text-slate-600"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold tabular-nums text-slate-500">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
