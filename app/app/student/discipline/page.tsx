"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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

export default function StudentDisciplinePage() {
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/student/discipline");
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
        <h1 className="text-2xl font-bold text-slate-900">My Discipline Records</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your conduct records and any actions taken
        </p>
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <h3 className="font-semibold text-emerald-800">No Records</h3>
          <p className="mt-1 text-sm text-emerald-600">
            You have no discipline records. Keep up the good conduct!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const severity = SEVERITY_LABELS[record.severity] || SEVERITY_LABELS[1];
            const status = STATUS_LABELS[record.status] || STATUS_LABELS.open;
            return (
              <div
                key={record.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{record.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {record.incident_date}
                      {record.incident_location ? ` — ${record.incident_location}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium", severity.color)}>
                      {severity.label}
                    </span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", status.color)}>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
