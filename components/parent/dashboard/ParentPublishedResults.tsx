import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";

import type { ParentResultRow } from "@/components/parent/dashboard/types";

export function ParentPublishedResults({
  results,
  loading,
  error,
}: {
  results: ParentResultRow[];
  loading: boolean;
  error: string;
}) {
  return (
    <section
      aria-labelledby="parent-published-results-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
            Published Results
          </p>
          <h2
            id="parent-published-results-heading"
            className="mt-1 text-2xl font-semibold text-slate-900"
          >
            Academic updates for linked children
          </h2>
        </div>
        {results.length > 0 ? (
          <Link
            href="/app/parent/results"
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            <Download className="h-4 w-4" />
            Download certificate
          </Link>
        ) : null}
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 grid place-items-center rounded-2xl border border-dashed border-slate-200 p-8 text-sm text-slate-500"
        >
          <Loader2 className="mb-3 h-5 w-5 animate-spin" />
          Loading published results...
        </div>
      ) : error ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      ) : results.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
          No published results are available for the selected child yet.
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Child</th>
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
                  <td className="px-3 py-3 text-slate-900">{result.studentName}</td>
                  <td className="px-3 py-3 text-slate-900">{result.assignmentTitle}</td>
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
                    {result.publishedAt
                      ? format(new Date(result.publishedAt), "MMM d, yyyy")
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
