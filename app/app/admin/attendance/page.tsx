"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import { primaryButton } from "@/lib/workspace/design";

type AttendanceSummary = {
  totalStudents?: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  attendanceRate?: number;
  summary?: {
    PRESENT?: number;
    ABSENT?: number;
    LATE?: number;
    EXCUSED?: number;
  };
  rows?: unknown[];
  recentSessions?: Array<{
    id?: string;
    date?: string;
    className?: string;
    present?: number;
    absent?: number;
    late?: number;
  }>;
};

export default function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/attendance/summary", { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || "Failed to load attendance summary");
      setSummary(payload?.data || payload?.summary || {});
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load attendance summary");
      setSummary({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cards = useMemo(
    () => [
      { label: "Students", value: summary?.totalStudents ?? "-", icon: Users },
      { label: "Present", value: summary?.presentCount ?? summary?.summary?.PRESENT ?? "-", icon: ClipboardCheck },
      { label: "Absent", value: summary?.absentCount ?? summary?.summary?.ABSENT ?? "-", icon: AlertTriangle },
      { label: "Rate", value: resolveAttendanceRate(summary), icon: CalendarCheck },
    ],
    [summary]
  );

  return (
    <div className="space-y-6 py-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance Oversight</h1>
          <p className="mt-1 text-sm text-slate-500">Review daily attendance signals across the school.</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className={primaryButton("disabled:opacity-60")}
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading ? (
        <Surface
          variant="default"
          role="status"
          aria-live="polite"
          className="grid place-items-center p-10 text-center text-sm text-slate-500"
        >
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-sky-500" />
          Loading attendance summary...
        </Surface>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Surface key={card.label} variant="default" className="p-5" as="div">
                <card.icon className="h-5 w-5 text-sky-600" />
                <p className="mt-4 text-2xl font-bold text-slate-900">{card.value}</p>
                <p className="mt-1 text-sm text-slate-500">{card.label}</p>
              </Surface>
            ))}
          </div>

          <Surface variant="default" className="p-5" as="div">
            <h2 className="font-semibold text-slate-900">Recent Sessions</h2>
            <div className="mt-4 divide-y divide-slate-100">
              {resolveRecentSessions(summary).length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No recent attendance sessions found.</p>
              ) : (
                resolveRecentSessions(summary).map((session, index) => (
                  <div key={session.id || index} className="grid gap-3 py-4 text-sm md:grid-cols-[1fr_auto_auto_auto]">
                    <div>
                      <p className="font-semibold text-slate-800">{session.className || "Class session"}</p>
                      <p className="text-slate-500">{session.date || "No date"}</p>
                    </div>
                    <p className="text-emerald-600">Present: {session.present ?? "-"}</p>
                    <p className="text-amber-600">Late: {session.late ?? "-"}</p>
                    <p className="text-rose-600">Absent: {session.absent ?? "-"}</p>
                  </div>
                ))
              )}
            </div>
          </Surface>
        </>
      )}
    </div>
  );
}

function resolveAttendanceRate(summary: AttendanceSummary | null) {
  if (!summary) return "-";
  if (typeof summary.attendanceRate === "number") return `${Math.round(summary.attendanceRate)}%`;
  const present = Number(summary.summary?.PRESENT || 0);
  const total = Object.values(summary.summary || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  return total > 0 ? `${Math.round((present / total) * 100)}%` : "-";
}

function resolveRecentSessions(summary: AttendanceSummary | null) {
  if (!summary) return [];
  if (summary.recentSessions?.length) return summary.recentSessions;
  return (summary.rows || []).slice(0, 10).map((row: any) => ({
    id: row.id,
    date: row.date,
    className: row.className,
    present: row.status === "PRESENT" ? 1 : 0,
    absent: row.status === "ABSENT" ? 1 : 0,
    late: row.status === "LATE" ? 1 : 0,
  }));
}
