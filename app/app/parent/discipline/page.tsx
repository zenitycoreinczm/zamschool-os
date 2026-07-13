"use client";

import { useEffect, useState } from "react";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";

type DisciplineRecord = {
  id: string;
  title: string;
  description: string | null;
  incident_date: string;
  incident_location: string | null;
  severity: number;
  status: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  student: {
    id: string;
    student_number: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  category: { id: string; name: string } | null;
  actions: Array<{
    id: string;
    action_type: string;
    description: string | null;
    action_date: string;
    duration_days: number | null;
  }>;
};

import { SEVERITY_LEVELS } from "@/lib/discipline-tokens";

const SEVERITY_LABELS = SEVERITY_LEVELS;

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "bg-amber-100 text-amber-700" },
  investigating: { label: "Investigating", color: "bg-blue-100 text-blue-700" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700" },
  escalated: { label: "Escalated", color: "bg-red-100 text-red-700" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600" },
};

export default function ParentDisciplinePage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/parent/discipline");
        const body = await res.json();
        setRecords(body.data || []);
      } catch {
        toast.error("Failed to load discipline records");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getStudentName = (student: DisciplineRecord["student"]) => {
    if (!student) return "Unknown";
    return [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student";
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center gap-3 py-20">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          <span className="text-sm text-slate-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Children&apos;s Discipline Records</h1>
        <p className="mt-1 text-sm text-slate-500">
          View conduct records for your linked children
        </p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h3 className="font-semibold text-emerald-800">No Records</h3>
          <p className="mt-1 text-sm text-emerald-600">
            Your children have no discipline records. Well done!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const severity = SEVERITY_LABELS[record.severity] || SEVERITY_LABELS[1];
            const status = STATUS_LABELS[record.status] || STATUS_LABELS.open;
            return (
              <Surface
                key={record.id}
                variant="default"
                className="p-5"
                as="article"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">
                        {getStudentName(record.student)}
                        {record.student?.student_number
                          ? ` (${record.student.student_number})`
                          : ""}
                      </span>
                    </div>
                    <h3 className="mt-1 font-semibold text-slate-900">{record.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {record.incident_date}
                      {record.incident_location ? ` — ${record.incident_location}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", severity.color)}>
                      {severity.label}
                    </span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", status.color)}>
                      {status.label}
                    </span>
                  </div>
                </div>

                {record.description && (
                  <p className="mt-3 text-sm text-slate-600">{record.description}</p>
                )}

                {record.resolution_notes && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-3">
                    <p className="text-xs font-medium text-slate-500">Resolution</p>
                    <p className="mt-1 text-sm text-slate-700">{record.resolution_notes}</p>
                  </div>
                )}

                {record.actions.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-500">Actions Taken</p>
                    <div className="mt-2 space-y-2">
                      {record.actions.map((action) => (
                        <div
                          key={action.id}
                          className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-slate-700 capitalize">
                            {action.action_type.replace("_", " ")}
                          </span>
                          {action.duration_days && (
                            <span className="text-slate-500">
                              ({action.duration_days} day(s))
                            </span>
                          )}
                          {action.description && (
                            <span className="text-slate-500">— {action.description}</span>
                          )}
                        </div>
                      ))}
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
