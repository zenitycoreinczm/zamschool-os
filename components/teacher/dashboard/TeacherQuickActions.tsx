import Link from "next/link";
import { ArrowRight } from "lucide-react";

type QuickAction = {
  label: string;
  href: string;
  desc: string;
};

const quickActions: QuickAction[] = [
  {
    label: "Take attendance",
    href: "/app/teacher/attendance",
    desc: "Mark today's lessons",
  },
  {
    label: "Assignments",
    href: "/app/teacher/assignments",
    desc: "Set homework and classwork",
  },
  {
    label: "Record results",
    href: "/app/teacher/results",
    desc: "Enter scores and grades",
  },
  {
    label: "View schedule",
    href: "/app/teacher/teaching",
    desc: "Today's lessons and classes",
  },
  {
    label: "Students",
    href: "/app/teacher/students",
    desc: "Class roster and profiles",
  },
  {
    label: "Conduct",
    href: "/app/teacher/discipline",
    desc: "Log behaviour notes",
  },
];

export function TeacherQuickActions() {
  return (
    <section
      aria-labelledby="teacher-quick-actions-heading"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Quick actions
          </p>
          <h2
            id="teacher-quick-actions-heading"
            className="mt-1 text-xl font-semibold text-slate-900"
          >
            Common tasks
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Designed so teachers don&apos;t need training — attendance in under
            30 seconds.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group flex items-start justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/40 px-3.5 py-3.5 transition hover:border-slate-300 hover:bg-white"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900 group-hover:text-slate-950">
                {action.label}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                {action.desc}
              </span>
            </span>
            <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </Link>
        ))}
      </div>
    </section>
  );
}
