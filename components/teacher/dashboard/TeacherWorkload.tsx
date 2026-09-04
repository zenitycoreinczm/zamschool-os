import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  FileText,
  GraduationCap,
  MessageSquare,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TeacherWorkloadSummary } from "@/lib/teacher-route-common";

type WorkloadKey = keyof TeacherWorkloadSummary;

type WorkloadCard = {
  label: string;
  key: WorkloadKey;
  href: string;
  icon: typeof MessageSquare;
  tone: "sky" | "amber" | "emerald" | "slate";
};

const workloadCards: WorkloadCard[] = [
  {
    label: "Unread Messages",
    key: "unreadMessages",
    href: "/app/teacher/inbox",
    icon: MessageSquare,
    tone: "sky",
  },
  {
    label: "Pending Grades",
    key: "pendingGrades",
    href: "/app/teacher/results",
    icon: GraduationCap,
    tone: "amber",
  },
  {
    label: "Draft Results",
    key: "draftResults",
    href: "/app/teacher/results",
    icon: FileText,
    tone: "slate",
  },
  {
    label: "Upcoming Events",
    key: "upcomingEvents",
    href: "/app/teacher/events",
    icon: Calendar,
    tone: "emerald",
  },
];

const toneStyles = {
  sky: "bg-sky-50 text-sky-700",
  amber: "bg-amber-50 text-amber-800",
  slate: "bg-slate-100 text-slate-700",
  emerald: "bg-emerald-50 text-emerald-700",
};

export function TeacherWorkload({ workload }: { workload: TeacherWorkloadSummary }) {
  return (
    <section
      aria-labelledby="teacher-workload-heading"
      className="rounded-workspace-2xl border border-slate-200 bg-white p-5 shadow-workspace-xs sm:p-6"
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

      <div className="mt-5 flex flex-col gap-2.5">
        {workloadCards.map((card) => {
          const raw = workload[card.key];
          const value =
            typeof raw === "number" && Number.isFinite(raw)
              ? raw
              : Array.isArray(raw)
                ? raw.length
                : 0;
          const Icon = card.icon;
          return (
            <Link
              key={card.key}
              href={card.href}
              className="group flex items-center justify-between rounded-2xl border border-slate-200/80 bg-slate-50/40 px-4 py-3 transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl",
                    toneStyles[card.tone],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium text-slate-800">{card.label}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "ws-tabular rounded-full px-2.5 py-0.5 text-xs font-bold",
                    value > 0
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-500",
                  )}
                >
                  {value}
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition duration-150 group-hover:translate-x-0.5 group-hover:text-slate-600" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
