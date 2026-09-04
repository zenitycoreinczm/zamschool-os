import Link from "next/link";
import { CalendarClock, Clock, Users, ArrowRight } from "lucide-react";

import type { LessonRow } from "@/components/teacher/dashboard/types";

export function TeacherTodaySchedule({
  lessons,
  loading,
}: {
  lessons: LessonRow[];
  loading: boolean;
}) {
  const todayCount = lessons.length;
  const totalRoster = lessons.reduce((sum, lesson) => sum + lesson.rosterCount, 0);

  return (
    <section
      aria-labelledby="teacher-today-heading"
      className="rounded-workspace-2xl border border-slate-200 bg-white p-5 shadow-workspace-xs sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Today
          </p>
          <h2
            id="teacher-today-heading"
            className="mt-1 text-xl font-semibold text-slate-900"
          >
            Your schedule
          </h2>
          {todayCount > 0 ? (
            <p className="mt-1 text-sm text-slate-500">
              {todayCount} lesson{todayCount !== 1 ? "s" : ""} · {totalRoster}{" "}
              student{totalRoster !== 1 ? "s" : ""} on roster
            </p>
          ) : null}
        </div>
        <Link
          href="/app/teacher/teaching"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Full schedule
        </Link>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"
        >
          Loading today&apos;s lessons...
        </div>
      ) : lessons.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm font-medium text-slate-600">
            No lessons scheduled for today
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Enjoy your day or check your timetable for upcoming classes.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lessons.slice(0, 6).map((lesson) => (
            <Link
              key={lesson.id}
              href={`/app/teacher/attendance?date=${lesson.date}`}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 leading-snug">
                    {lesson.subjectName}
                  </p>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {lesson.className}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {lesson.startTime?.slice(0, 5)} – {lesson.endTime?.slice(0, 5)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {lesson.rosterCount}
                  </span>
                </div>
              </div>
              <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                <span>Take roll call</span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
