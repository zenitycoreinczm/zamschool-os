import Link from "next/link";
import { ArrowUpRight, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

type ModuleCardProps = {
  title: string;
  description: string;
  href: string;
  /** @deprecated Decorative icons removed */
  icon?: ComponentType<LucideProps>;
  tone?: string;
};

export function ModuleCard({ title, description, href }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative block min-h-[7.5rem] overflow-hidden rounded-workspace-xl border border-workspace-border bg-white p-4 shadow-workspace-sm",
        "transition duration-[var(--duration-workspace-normal)] ease-[var(--ease-workspace-out)]",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-workspace-md focus-visible:shadow-workspace-focus",
      )}
    >
      <div className="relative min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug tracking-tight text-slate-900">
            {title}
          </h3>
          <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-brand transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-hover" />
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-workspace-muted">
          {description}
        </p>
      </div>
    </Link>
  );
}
