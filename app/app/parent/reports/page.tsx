"use client";

import { useEffect, useRef, useState } from "react";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";

import { cn } from "@/lib/utils";

type ReportResult = {
  id: string;
  assignmentTitle: string;
  subjectName: string;
  score: number | null;
  grade: string | null;
  remarks: string | null;
  publishedAt: string | null;
};

type Report = {
  studentId: string;
  studentName: string;
  totalResults: number;
  averageScore: number | null;
  results: ReportResult[];
};

export default function ParentReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const load = async () => {
      const [childrenRes, reportsRes] = await Promise.all([
        fetch("/api/parent/children"),
        fetch("/api/parent/reports"),
      ]);

      if (childrenRes.ok) {
        const body = await childrenRes.json();
        setChildren(body.data ?? []);
      }

      if (reportsRes.ok) {
        const body = await reportsRes.json();
        setReports(body.data ?? []);
      } else {
        setError("Failed to load reports");
      }

      setLoading(false);
    };

    void load();
  }, []);

  const filteredReports = selectedChild
    ? reports.filter((r) => r.studentId === selectedChild)
    : reports;

  if (loading) return <WorkspaceLoader label="Loading reports" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Report Cards</h1>
          <p className="text-sm text-slate-500">
            Academic performance summary for your children
          </p>
        </div>
        {children.length > 1 && (
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">All children</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
        </Surface>
      ) : filteredReports.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No report data available yet.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isExpanded = expandedStudent === report.studentId;
            return (
              <Surface
                key={report.studentId}
                variant="elevated"
                className="overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStudent(isExpanded ? null : report.studentId)
                  }
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {report.studentName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {report.totalResults} published results
                    </p>
                  </div>
                  <div className="text-right">
                    {report.averageScore != null ? (
                      <>
                        <p className="text-xs text-slate-500">Average</p>
                        <p
                          className={cn(
                            "text-lg font-bold",
                            report.averageScore >= 75
                              ? "text-emerald-600"
                              : report.averageScore >= 50
                                ? "text-amber-600"
                                : "text-rose-600",
                          )}
                        >
                          {report.averageScore}%
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">No scores</p>
                    )}
                  </div>
                </button>

                {isExpanded && report.results.length > 0 && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50">
                          <th className="px-5 py-2 text-left font-medium text-slate-600">
                            Subject
                          </th>
                          <th className="px-5 py-2 text-left font-medium text-slate-600">
                            Assignment
                          </th>
                          <th className="px-5 py-2 text-left font-medium text-slate-600">
                            Score
                          </th>
                          <th className="px-5 py-2 text-left font-medium text-slate-600">
                            Grade
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {report.results.map((result) => (
                          <tr key={result.id}>
                            <td className="px-5 py-2 text-slate-700">
                              {result.subjectName}
                            </td>
                            <td className="px-5 py-2 text-slate-600">
                              {result.assignmentTitle}
                            </td>
                            <td className="px-5 py-2 font-medium text-slate-900">
                              {result.score != null ? `${result.score}%` : "-"}
                            </td>
                            <td className="px-5 py-2">
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                                {result.grade || "Pending"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Surface>
            );
          })}
        </div>
      )}
    </div>
  );
}
