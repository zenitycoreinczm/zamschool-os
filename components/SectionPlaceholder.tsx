import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/workspace/PageHeader";

export default function SectionPlaceholder({
  title,
  summary,
  primaryHref,
  primaryLabel,
  eyebrow = "Workspace module",
}: {
  title: string;
  summary: string;
  primaryHref?: string;
  primaryLabel?: string;
  eyebrow?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={summary} accent="slate" />

      <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-white to-slate-50/80 p-6">
        <p className="text-sm leading-relaxed text-slate-600">
          This section shell is wired under <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/app</code>{" "}
          with role-scoped navigation. Next step is full CRUD and live data binding for this module.
        </p>

        {primaryHref && primaryLabel ? (
          <Link
            href={primaryHref}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-400"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}