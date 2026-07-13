"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
  TeacherStatCard,
  teacherInputClass,
  teacherPillClass,
} from "@/components/teacher/TeacherWorkspaceUI";
import { cn } from "@/lib/utils";

type DisciplineRecord = {
  id: string;
  title: string;
  description: string | null;
  incident_date: string;
  incident_location: string | null;
  severity: number;
  status: string;
  created_at: string;
  student: {
    id: string;
    student_number: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  category: { id: string; name: string; severity?: number | null } | null;
  class: { id: string; name: string } | null;
  reporter: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

import { SEVERITY_LEVELS_BORDERED, DISCIPLINE_STATUS_BORDERED } from "@/lib/discipline-tokens";

const SEVERITY_LABELS = SEVERITY_LEVELS_BORDERED;
const STATUS_LABELS = DISCIPLINE_STATUS_BORDERED;

export default function TeacherDisciplinePage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/discipline/records", {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body.error || "Failed to load discipline records");
        }
        setRecords(Array.isArray(body.data) ? body.data : []);
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load discipline records",
        );
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const term = searchTerm.toLowerCase();
    return records.filter((record) => {
      const studentName = getStudentName(record.student).toLowerCase();
      return (
        studentName.includes(term) ||
        record.title.toLowerCase().includes(term) ||
        (record.class?.name || "").toLowerCase().includes(term) ||
        (record.category?.name || "").toLowerCase().includes(term)
      );
    });
  }, [records, searchTerm]);

  const openRecords = records.filter(
    (record) => record.status === "open",
  ).length;
  const highSeverity = records.filter((record) => record.severity >= 4).length;

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-4 md:p-6">
        <TeacherCard className="grid w-full max-w-lg place-items-center py-14 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-workspace-muted">
            Loading discipline records…
          </p>
        </TeacherCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TeacherPageHeader
        eyebrow="Student support"
        title="Discipline Records"
        description="A calm, card-based view of conduct records for students in your teaching scope."
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <TeacherStatCard
          label="Total records"
          value={records.length}
          hint="Visible to you"
        />
        <TeacherStatCard
          label="Open"
          value={openRecords}
          hint="Needs follow-up"
        />
        <TeacherStatCard
          label="High severity"
          value={highSeverity}
          hint="Serious or critical"
        />
        <TeacherStatCard
          label="Showing"
          value={filtered.length}
          hint="After filters"
        />
      </div>

      <TeacherCard>
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by student, incident, class, or category…"
            className={cn(teacherInputClass, "pl-10")}
          />
        </div>
      </TeacherCard>

      {filtered.length === 0 ? (
        <TeacherEmptyState
          title="No discipline records"
          description={
            searchTerm
              ? "No records match your current search."
              : "Discipline records for your students will appear here when available."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((record) => {
            const severity =
              SEVERITY_LABELS[record.severity] || SEVERITY_LABELS[1];
            const status = STATUS_LABELS[record.status] || STATUS_LABELS.open;
            return (
              <TeacherCard
                key={record.id}
                className="transition hover:-translate-y-0.5 hover:shadow-workspace-md"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold tracking-tight text-slate-950">
                        {record.title}
                      </h2>
                      <p className="mt-1 text-sm text-workspace-muted">
                        {getStudentName(record.student)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold shadow-workspace-xs",
                        status.className,
                      )}
                    >
                      {status.label}
                    </span>
                  </div>

                  {record.description ? (
                    <p className="text-sm leading-relaxed text-slate-600">
                      {record.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <span className={teacherPillClass}>
                      {record.class?.name || "No class"}
                    </span>
                    {record.category?.name ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-workspace-xs">
                        {record.category.name}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-semibold shadow-workspace-xs",
                        severity.className,
                      )}
                    >
                      {severity.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 border-t border-workspace-border pt-3 text-xs text-workspace-muted sm:grid-cols-2">
                    <span>Incident date: {record.incident_date || "—"}</span>
                    <span>Location: {record.incident_location || "—"}</span>
                  </div>
                </div>
              </TeacherCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getStudentName(student: DisciplineRecord["student"]) {
  if (!student) return "Unknown student";
  return (
    [student.first_name, student.last_name].filter(Boolean).join(" ") ||
    "Student"
  );
}
