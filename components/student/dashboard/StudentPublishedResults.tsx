import Link from "next/link";
import { format } from "date-fns";
import { Download } from "lucide-react";

import type { StudentResultRow } from "@/components/student/dashboard/types";

export function StudentPublishedResults({ results }: { results: StudentResultRow[] }) {
  return (
    <section
      aria-labelledby="student-results-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Published Results
          </p>
          <h2
            id="student-results-heading"
            className="mt-1 text-2xl font-semibold text-slate-900"
          >
            Academic records
          </h2>
        </div>
        {results.length > 0 ? (
          <Link
            href="/app/student/results"
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            <Download className="h-4 w-4" />
            Download certificate
          </Link>
        ) : null}
      </div>

      {results.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
          No published results are available yet. When teachers publish marks,
          you can download a multi-subject certificate from Results.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Assignment</th>
                <th className="px-3 py-3 font-medium">Subject</th>
                <th className="px-3 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">Grade</th>
                <th className="px-3 py-3 font-medium">Published</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.id}
                  className="border-b border-slate-100 last:border-b-0"
                >
                  <td className="px-3 py-3 text-slate-900">
                    {result.assignmentTitle}
                  </td>
                  <td className="px-3 py-3 text-slate-600">{result.subjectName}</td>
                  <td className="px-3 py-3 text-slate-900">
                    {result.score == null ? "-" : result.score}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                      {result.grade || "Pending"}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {result.published_at
                      ? format(new Date(result.published_at), "MMM d, yyyy")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Tip: open Results to download one certificate that lists every
            subject for the exam (school, class, scores, grades).
          </p>
        </div>
      )}
    </section>
  );
}
