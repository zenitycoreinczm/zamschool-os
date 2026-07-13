import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TeacherWorkloadSummary } from "@/lib/teacher-route-common";

type WorkloadKey = keyof TeacherWorkloadSummary;

type WorkloadCard = {
  label: string;
  key: WorkloadKey;
  href: string;
};

const workloadCards: WorkloadCard[] = [
  {
    label: "Unread Messages",
    key: "unreadMessages",
    href: "/app/teacher/inbox",
  },
  {
    label: "Pending Grades",
    key: "pendingGrades",
    href: "/app/teacher/results",
  },
  {
    label: "Draft Results",
    key: "draftResults",
    href: "/app/teacher/results",
  },
  {
    label: "Upcoming Events",
    key: "upcomingEvents",
    href: "/app/teacher/events",
  },
];

export function TeacherWorkload({ workload }: { workload: TeacherWorkloadSummary }) {
  return (
    <section
      aria-labelledby="teacher-workload-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Workload
      </p>
      <h2
        id="teacher-workload-heading"
        className="mt-1 text-xl font-semibold text-slate-900"
      >
        At a glance
      </h2>

      <div className="mt-5 flex flex-col gap-2">
        {workloadCards.map((card) => {
          const raw = workload[card.key];
          // Guard against API accidentally returning arrays/objects for counts
          const value =
            typeof raw === "number" && Number.isFinite(raw)
              ? raw
              : Array.isArray(raw)
                ? raw.length
                : 0;
          return (
            <Link
              key={card.key}
              href={card.href}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm font-medium text-slate-700">{card.label}</p>
              <p className={cn("ws-tabular text-lg font-bold text-slate-900")}>
                {value}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
