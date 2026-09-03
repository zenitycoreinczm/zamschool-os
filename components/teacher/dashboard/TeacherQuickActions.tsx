import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  ClipboardList,
  FileBarChart2,
  Shield,
  Users,
} from "lucide-react";

type QuickAction = {
  label: string;
  href: string;
  desc: string;
  icon: typeof Users;
};

const quickActions: QuickAction[] = [
  {
    label: "Take attendance",
    href: "/app/teacher/attendance",
    desc: "Roll call in under 30 seconds — works offline.",
    icon: CalendarCheck,
  },
  {
    label: "Record results",
    href: "/app/teacher/results",
    desc: "Enter CA and exam marks, publish to parents.",
    icon: FileBarChart2,
  },
  {
    label: "Assignments",
    href: "/app/teacher/assignments",
    desc: "Set homework and classwork, track submissions.",
    icon: ClipboardList,
  },
  {
    label: "Students",
    href: "/app/teacher/students",
    desc: "Class rosters, attendance risk, and profiles.",
    icon: Users,
  },
  {
    label: "Schedule",
    href: "/app/teacher/teaching",
    desc: "Today's lessons and timetable by day.",
    icon: Calendar,
  },
  {
    label: "Conduct",
    href: "/app/teacher/discipline",
    desc: "Log behaviour notes and follow-ups.",
    icon: Shield,
  },
];

export function TeacherQuickActions() {
  return (
    <section aria-label="Quick actions">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="ws-eyebrow text-slate-400">Quick actions</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Common tasks
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Designed so teachers don&apos;t need training — attendance in under
            30 seconds.
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-start gap-3.5 rounded-workspace-2xl border border-slate-200 bg-white p-4 shadow-workspace-xs transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-workspace-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/70 transition-colors duration-150 group-hover:bg-slate-900 group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {action.label}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition duration-150 group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                  {action.desc}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
