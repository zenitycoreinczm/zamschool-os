"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Search } from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
  TeacherStatCard,
  teacherInputClass,
  teacherPillClass,
} from "@/components/teacher/TeacherWorkspaceUI";
import { cn } from "@/lib/utils";

type StudentRow = {
  id: string;
  displayName: string;
  admissionNumber: string | null;
  email: string | null;
  className: string;
  attendance?: { rate: number | null; total: number };
  results?: { averageScore: number | null; total: number };
  riskLevel?: "low" | "medium" | "high" | string;
  flags?: string[];
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

export default function TeacherStudentsPage() {
  const { loading: wsLoading } = useTeacherWorkspace();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [summary, setSummary] = useState<TeacherStudentsPayload["summary"]>();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminApiJson<{
        success: boolean;
        data?: TeacherStudentsPayload;
      }>("/api/teacher/students");
      const payload = body.data;
      setStudents(Array.isArray(payload?.students) ? payload.students : []);
      setSummary(payload?.summary);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load students";
      toast.error(message);
      setStudents([]);
      setSummary(undefined);
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
    let list = students;
    if (selectedClass !== "all") {
      list = list.filter((s) => s.className === selectedClass);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          (s.displayName ?? "").toLowerCase().includes(term) ||
          (s.admissionNumber ?? "").toLowerCase().includes(term) ||
          (s.className ?? "").toLowerCase().includes(term),
      );
    }
    return list;
  }, [students, searchTerm, selectedClass]);

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
        eyebrow="Roster"
        title="My Students"
        description="Full class rosters for every class you teach or supervise - not only classes where you are the class teacher."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <TeacherStatCard
          label="Total students"
          value={summary?.totalStudents ?? students.length}
          hint="In your teaching scope"
        />
        <TeacherStatCard
          label="Classes"
          value={summary?.classes ?? classNames.length}
          hint="Assigned or supervised"
        />
        <TeacherStatCard
          label="High risk"
          value={
            summary?.highRiskStudents ??
            students.filter((s) => s.riskLevel === "high").length
          }
          hint="Needs attention"
        />
        <TeacherStatCard
          label="Showing"
          value={filtered.length}
          hint="After filters"
        />
      </div>

      <TeacherCard>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, class, or admission number…"
              className={cn(teacherInputClass, "pl-10")}
            />
          </div>
          {classNames.length > 1 ? (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className={cn(teacherInputClass, "md:w-56")}
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
          description={
            searchTerm || selectedClass !== "all"
              ? "Try a different search term or class filter."
              : "Students will appear here once they are assigned to your classes."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filtered.map((student) => (
            <TeacherCard
              key={student.id}
              className="transition hover:-translate-y-0.5 hover:shadow-workspace-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-bold tracking-tight text-slate-950">
                      {student.displayName || "Student"}
                    </h2>
                    {student.riskLevel === "high" ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        At risk
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={teacherPillClass}>
                      {student.className || "No class"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-workspace-xs">
                      {student.admissionNumber || "No admission #"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-workspace-lg bg-slate-50/80 p-3 ring-1 ring-workspace-border">
                  <p className="text-xs font-medium text-workspace-muted">
                    Attendance
                  </p>
                  <p className="ws-tabular mt-1 text-lg font-bold text-slate-950">
                    {student.attendance?.rate ?? "-"}%
                  </p>
                </div>
                <div className="rounded-workspace-lg bg-slate-50/80 p-3 ring-1 ring-workspace-border">
                  <p className="text-xs font-medium text-workspace-muted">
                    Average score
                  </p>
                  <p className="ws-tabular mt-1 text-lg font-bold text-slate-950">
                    {student.results?.averageScore ?? "-"}%
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-workspace-border pt-3">
                {student.email ? (
                  <a
                    href={`mailto:${student.email}`}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 hover:text-amber-800"
                  >
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                ) : (
                  <span className="text-sm text-workspace-muted">No email</span>
                )}
                {student.flags && student.flags.length > 0 ? (
                  <span className="text-xs font-medium text-workspace-muted">
                    {student.flags.length} signal
                    {student.flags.length === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
            </TeacherCard>
          ))}
        </div>
      )}
    </div>
  );
}
