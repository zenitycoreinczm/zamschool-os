import { Paperclip, Send } from "lucide-react";

import { MiniStat } from "@/components/student/dashboard/MiniStat";
import {
  formatDateLabel,
  formatDateTimeLabel,
  formatSubmissionStatus,
  submissionStatusPill,
} from "@/components/student/dashboard/format";
import type { StudentAssignmentRow } from "@/components/student/dashboard/types";

export function StudentUpcomingAssignments({
  assignments,
  onSubmit,
}: {
  assignments: StudentAssignmentRow[];
  onSubmit: (assignment: StudentAssignmentRow) => void;
}) {
  return (
    <section
      aria-labelledby="student-assignments-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
        Upcoming Assignments
      </p>
      <h2
        id="student-assignments-heading"
        className="mt-1 text-2xl font-semibold text-slate-900"
      >
        Submit work
      </h2>

      {assignments.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          No active assignments are available right now.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {assignments.map((assignment) => (
            <article
              key={assignment.id}
              className="rounded-2xl border border-slate-200 p-5"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-slate-900">
                      {assignment.title}
                    </p>
                    <span className={submissionStatusPill(assignment.submissionStatus)}>
                      {formatSubmissionStatus(assignment.submissionStatus)}
                    </span>
                    {assignment.urgent ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        Due soon
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {assignment.subjectName} | {assignment.teacherName} | Due{" "}
                    {formatDateLabel(assignment.dueDate)}
                  </p>
                  {assignment.description ? (
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                      {assignment.description}
                    </p>
                  ) : null}
                  {assignment.submissionLink ? (
                    <a
                      href={assignment.submissionLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex text-sm font-medium text-slate-800 underline-offset-2 hover:underline"
                    >
                      View submitted link
                    </a>
                  ) : null}
                  {assignment.submissionFileUrl ? (
                    <a
                      href={assignment.submissionFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {assignment.submissionFileName || "View submitted file"}
                    </a>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[320px]">
                  <MiniStat
                    label="Due date"
                    value={formatDateLabel(assignment.dueDate)}
                  />
                  <MiniStat
                    label="Total marks"
                    value={String(assignment.totalMarks ?? 0)}
                  />
                  <MiniStat
                    label="Submitted"
                    value={
                      assignment.submittedAt
                        ? formatDateTimeLabel(assignment.submittedAt)
                        : "Not yet"
                    }
                  />
                  <MiniStat
                    label="Last updated"
                    value={
                      assignment.updatedAt
                        ? formatDateTimeLabel(assignment.updatedAt)
                        : "Not yet"
                    }
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => onSubmit(assignment)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  <Send className="h-4 w-4" />
                  {assignment.submissionStatus === "submitted"
                    ? "Update submission"
                    : "Submit work"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
