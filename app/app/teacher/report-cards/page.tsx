"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles, Check, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
  teacherInputClass,
  teacherPillClass,
} from "@/components/teacher/TeacherWorkspaceUI";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import { getECZGrade } from "@/lib/zambia-localization";

type RecentResult = {
  id: string;
  assessmentType: string;
  date: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  remarks: string | null;
};

type AttendanceData = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate: number | null;
};

type StudentRow = {
  id: string;
  displayName: string;
  admissionNumber: string | null;
  className: string;
  classId: string;
  attendance: AttendanceData;
  results: {
    total: number;
    averageScore: number | null;
    lowScoreCount: number;
    recent: RecentResult[];
  };
  flags: string[];
  riskLevel: "low" | "medium" | "high";
};

type TeacherStudentsPayload = {
  students: StudentRow[];
  summary?: {
    totalStudents: number;
    classes: number;
    highRiskStudents: number;
    mediumRiskStudents: number;
  };
};

type StudentCommentState = {
  generating: boolean;
  comment: string;
};

export default function TeacherReportCardsPage() {
  const { loading: wsLoading } = useTeacherWorkspace();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, StudentCommentState>>(
    {},
  );

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminApiJson<{
        success: boolean;
        data?: TeacherStudentsPayload;
      }>("/api/teacher/students");
      const payload = body.data;
      setStudents(Array.isArray(payload?.students) ? payload.students : []);
    } catch {
      toast.error("Failed to load students");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const classNames = useMemo(() => {
    const set = new Set(students.map((s) => s.className).filter(Boolean));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    if (selectedClass === "all") return students;
    return students.filter((s) => s.className === selectedClass);
  }, [students, selectedClass]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const highRisk = filtered.filter((s) => s.riskLevel === "high").length;
    const mediumRisk = filtered.filter((s) => s.riskLevel === "medium").length;
    return { total, highRisk, mediumRisk };
  }, [filtered]);

  const generateComment = async (student: StudentRow) => {
    setComments((prev) => ({
      ...prev,
      [student.id]: { generating: true, comment: "" },
    }));

    try {
      const res = await fetch("/api/ai/report-card-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentName: student.displayName,
          className: student.className,
          termName: "Current Term",
          subjects: student.results.recent.map((r) => ({
            name: r.assessmentType,
            score: r.percentage ?? r.score,
            maxScore: 100,
            grade: r.percentage != null ? getECZGrade(r.percentage).grade : null,
          })),
          attendanceRate: student.attendance.rate,
          flags: student.flags,
          riskLevel: student.riskLevel,
        }),
      });
      const body = await res.json();

      setComments((prev) => ({
        ...prev,
        [student.id]: {
          generating: false,
          comment: body.data?.comment ?? "",
        },
      }));
    } catch {
      setComments((prev) => ({
        ...prev,
        [student.id]: {
          generating: false,
          comment: "",
        },
      }));
      toast.error("Failed to generate comment");
    }
  };

  const copyComment = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Comment copied"),
      () => toast.error("Failed to copy"),
    );
  };

  const getGradeColor = (percentage: number | null) => {
    if (percentage == null) return "text-slate-400";
    if (percentage >= 75) return "text-emerald-600";
    if (percentage >= 50) return "text-amber-600";
    return "text-rose-600";
  };

  if (wsLoading || loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-4 md:p-6">
        <TeacherCard className="grid w-full max-w-lg place-items-center py-14 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-workspace-muted">
            Loading students…
          </p>
        </TeacherCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TeacherPageHeader
        eyebrow="AI-powered"
        title="Report Card Comments"
        description="Select a class and generate personalised report card comments for each student using AI."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <TeacherCard>
          <p className="ws-tabular text-2xl font-bold tracking-tight text-slate-950">
            {summary.total}
          </p>
          <p className="text-sm font-semibold text-slate-700">Students</p>
        </TeacherCard>
        <TeacherCard>
          <p className="ws-tabular text-2xl font-bold tracking-tight text-amber-600">
            {summary.mediumRisk}
          </p>
          <p className="text-sm font-semibold text-slate-700">Medium risk</p>
        </TeacherCard>
        <TeacherCard>
          <p className="ws-tabular text-2xl font-bold tracking-tight text-rose-600">
            {summary.highRisk}
          </p>
          <p className="text-sm font-semibold text-slate-700">High risk</p>
        </TeacherCard>
      </div>

      <TeacherCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-workspace-muted">
              Select a class to view students and generate comments
            </p>
          </div>
          {classNames.length > 1 ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className={cn(teacherInputClass, "md:w-64")}
            >
              <option value="all">All classes</option>
              {classNames.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </TeacherCard>

      {filtered.length === 0 ? (
        <TeacherEmptyState
          title="No students found"
          description="Students will appear here once they are assigned to your classes."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((student) => {
            const isExpanded = expandedStudent === student.id;
            const commentState = comments[student.id];

            return (
              <Surface
                key={student.id}
                variant="elevated"
                className="overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedStudent(isExpanded ? null : student.id)
                  }
                  className="flex w-full items-center justify-between p-4 text-left md:p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-bold tracking-tight text-slate-950">
                        {student.displayName || "Student"}
                      </h2>
                      {student.riskLevel === "high" ? (
                        <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                          At risk
                        </span>
                      ) : student.riskLevel === "medium" ? (
                        <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Watch
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{student.className}</span>
                      {student.admissionNumber ? (
                        <>
                          <span>·</span>
                          <span>{student.admissionNumber}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>
                        Avg: {student.results.averageScore ?? "-"}%
                      </span>
                      <span>·</span>
                      <span>
                        Att: {student.attendance.rate ?? "-"}%
                      </span>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronDown className="ml-2 h-5 w-5 shrink-0 text-slate-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {student.results.recent.length > 0 ? (
                      <div className="divide-y divide-slate-50 px-4 py-3 md:px-5">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Recent assessments
                        </p>
                        {student.results.recent.map((result) => (
                          <div
                            key={result.id}
                            className="flex items-center justify-between py-1.5 text-sm"
                          >
                            <span className="text-slate-700">
                              {result.assessmentType}
                            </span>
                            <span
                              className={cn(
                                "font-semibold",
                                getGradeColor(result.percentage),
                              )}
                            >
                              {result.percentage != null
                                ? `${result.percentage}%`
                                : result.score != null
                                  ? `${result.score}/${result.maxScore ?? 100}`
                                  : "-"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-400 md:px-5">
                        No assessment data available
                      </div>
                    )}

                    <div className="border-t border-slate-100 px-4 py-4 md:px-5">
                      {!commentState ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void generateComment(student);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-amber-600 hover:to-orange-600"
                        >
                          <Sparkles className="h-4 w-4" />
                          Generate AI Comment
                        </button>
                      ) : commentState.generating ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generating comment…
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              AI-generated comment
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyComment(commentState.comment);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                          </div>
                          <p className="rounded-xl bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-slate-800 ring-1 ring-amber-200/40">
                            {commentState.comment}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void generateComment(student);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Regenerate
                          </button>
                        </div>
                      )}
                    </div>
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
