import Link from "next/link";
import { ChevronRight, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";

import type { HeroAccent } from "@/components/workspace/heroAccents";
import { cn } from "@/lib/utils";

type QuickLinkCardProps = {
  href: string;
  title: string;
  description: string;
  /** @deprecated Decorative icons removed */
  icon?: ComponentType<LucideProps>;
  accent?: HeroAccent;
};

export function QuickLinkCard({
  href,
  title,
  description,
}: QuickLinkCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center justify-between rounded-workspace-xl border border-workspace-border bg-white p-5 shadow-workspace-sm",
        "transition duration-[var(--duration-workspace-normal)] ease-[var(--ease-workspace-out)]",
        "hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-workspace-md focus-visible:shadow-workspace-focus",
      )}
    >
      <div className="min-w-0 pr-3">
        <p className="font-semibold tracking-tight text-slate-900">{title}</p>
        <p className="text-sm text-workspace-muted">{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-600" />
    </Link>
  );
}
