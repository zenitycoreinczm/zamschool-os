import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  DEFAULT_ATTENDANCE_SUMMARY,
  type AttendanceSummary,
  type ParentChildRow,
} from "@/components/parent/dashboard/types";

type ChildSummary = ParentChildRow & { summary?: AttendanceSummary };

export function ParentLinkedChildren({
  linkedChildren,
  childSummaries,
  selectedChildId,
  onSelectChild,
}: {
  linkedChildren: ParentChildRow[];
  childSummaries: ChildSummary[];
  selectedChildId: string;
  onSelectChild: (childId: string) => void;
}) {
  return (
    <section
      aria-labelledby="parent-linked-children-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Linked children
        </p>
        <h2
          id="parent-linked-children-heading"
          className="mt-0.5 text-xl font-semibold text-slate-900 sm:text-2xl"
        >
          {linkedChildren.length === 0
            ? "No linked children yet"
            : `${linkedChildren.length} child${linkedChildren.length === 1 ? "" : "ren"}`}
        </h2>
      </div>

      {linkedChildren.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          Parent attendance will appear here once an admin links your account to
          at least one student profile.
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {linkedChildren.map((child) => {
            const summary =
              childSummaries.find((item) => item.id === child.id)?.summary ||
              child.summary ||
              DEFAULT_ATTENDANCE_SUMMARY;
            const isActive =
              selectedChildId === "all"
                ? false
                : selectedChildId === child.id;

            return (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelectChild(child.id)}
                aria-pressed={isActive}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition",
                  isActive
                    ? "border-slate-400 bg-slate-50 ring-1 ring-slate-300"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {child.displayName}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {child.className}
                      {child.relationship ? ` | ${child.relationship}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 text-slate-400" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    Present:{" "}
                    <span className="font-semibold text-slate-900">
                      {summary.PRESENT}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2">
                    Absent:{" "}
                    <span className="font-semibold text-slate-900">
                      {summary.ABSENT}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
