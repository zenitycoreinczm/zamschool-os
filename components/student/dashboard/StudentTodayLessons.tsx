import { formatTimeRange } from "@/components/student/dashboard/format";
import type { StudentLesson } from "@/components/student/dashboard/types";
import { cn } from "@/lib/utils";

export function StudentTodayLessons({ lessons }: { lessons: StudentLesson[] }) {
  return (
    <section
      aria-labelledby="student-today-lessons-heading"
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Schedule
          </p>
          <h2
            id="student-today-lessons-heading"
            className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl"
          >
            Today&apos;s lessons
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
          {lessons.length}
        </span>
      </div>

      <div className="mt-4 space-y-2.5">
        {lessons.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
            No lessons are scheduled for today.
          </div>
        ) : (
          lessons.map((lesson, index) => (
            <div
              key={lesson.id}
              className={cn(
                "flex items-start gap-3 rounded-2xl border border-slate-150 bg-slate-50/40 px-3.5 py-3.5 sm:px-4",
                "border-slate-200",
              )}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold tabular-nums text-teal-700 shadow-sm ring-1 ring-slate-200/80">
                {String(index + 1).padStart(2, "0")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">
                  {lesson.subjectName}
                  {lesson.subjectCode ? (
                    <span className="ml-2 text-xs font-medium text-slate-400">
                      {lesson.subjectCode}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {lesson.teacherName}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {formatTimeRange(lesson.startTime, lesson.endTime)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
