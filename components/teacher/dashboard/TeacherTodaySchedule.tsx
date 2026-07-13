import Link from "next/link";

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
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
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
          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Full schedule
        </Link>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"
        >
          Loading today&apos;s lessons…
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
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lessons.slice(0, 6).map((lesson) => (
            <Link
              key={lesson.id}
              href={`/app/teacher/attendance?date=${lesson.date}`}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="font-semibold text-slate-900">{lesson.subjectName}</p>
              <p className="mt-0.5 text-sm text-slate-500">{lesson.className}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>
                  {lesson.startTime?.slice(0, 5)} – {lesson.endTime?.slice(0, 5)}
                </span>
                <span>{lesson.rosterCount} students</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
