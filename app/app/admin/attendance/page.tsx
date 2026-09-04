"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import { adminApiJson } from "@/lib/admin-browser-api";

type AttendanceSession = {
  id: string;
  date: string;
  className: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type AttendanceSummary = {
  totalStudents?: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  excusedCount?: number;
  attendanceRate?: number;
  summary?: {
    PRESENT?: number;
    ABSENT?: number;
    LATE?: number;
    EXCUSED?: number;
  };
  recentSessions?: AttendanceSession[];
};

type RangeOption = "week" | "month";

export default function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>("week");
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  const load = useCallback(async (selectedRange: RangeOption = range) => {
    setLoading(true);
    try {
      const payload = await adminApiJson<{
        success?: boolean;
        data?: AttendanceSummary;
        summary?: AttendanceSummary;
      }>(`/api/admin/attendance/summary?range=${selectedRange}`);
      setSummary(payload?.data || payload?.summary || {});
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load attendance summary",
      );
      setSummary({});
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load(range);
  }, [range, load]);

  const totalStudents = summary?.totalStudents ?? 0;
  const presentCount =
    summary?.presentCount ?? summary?.summary?.PRESENT ?? 0;
  const absentCount = summary?.absentCount ?? summary?.summary?.ABSENT ?? 0;
  const lateCount = summary?.lateCount ?? summary?.summary?.LATE ?? 0;
  const excusedCount =
    summary?.excusedCount ?? summary?.summary?.EXCUSED ?? 0;

  const totalMarks = presentCount + absentCount + lateCount + excusedCount;
  const attendanceRate =
    typeof summary?.attendanceRate === "number"
      ? summary.attendanceRate
      : totalMarks > 0
        ? Math.round(((presentCount + lateCount + excusedCount) / totalMarks) * 100)
        : 100;

  const rateColor =
    attendanceRate >= 90
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : attendanceRate >= 80
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-rose-700 bg-rose-50 border-rose-200";

  const rateIcon =
    attendanceRate >= 90 ? (
      <TrendingUp className="h-4 w-4 text-emerald-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-rose-600" />
    );

  const sessions = summary?.recentSessions || [];

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Attendance Oversight
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track daily attendance rates, absence patterns, and lesson coverage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Range toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRange("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition",
                range === "week"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => setRange("month")}
              className={cn(
                "rounded-lg px-3 py-1.5 transition",
                range === "month"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Last 30 Days
            </button>
          </div>

          <button
            type="button"
            onClick={() => void load(range)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <Surface
          variant="default"
          role="status"
          aria-live="polite"
          className="grid place-items-center p-12 text-center text-sm text-slate-500"
        >
          <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-slate-500" />
          Loading school attendance signals…
        </Surface>
      ) : (
        <>
          {/* Top Metrics Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Surface variant="default" className="p-5" as="div">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Overall Rate
                </p>
                {rateIcon}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tabular-nums text-slate-900">
                  {attendanceRate}%
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                    rateColor,
                  )}
                >
                  {attendanceRate >= 90
                    ? "Healthy"
                    : attendanceRate >= 80
                      ? "Attention"
                      : "Critical"}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Present & late marks vs total
              </p>
            </Surface>

            <Surface variant="default" className="p-5" as="div">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Present Marks
                </p>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-emerald-700">
                {presentCount.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {totalMarks > 0
                  ? `${Math.round((presentCount / totalMarks) * 100)}% of roll call`
                  : "No marks recorded"}
              </p>
            </Surface>

            <Surface variant="default" className="p-5" as="div">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Late Arrivals
                </p>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-amber-700">
                {lateCount.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                Logged past the morning/lesson bell
              </p>
            </Surface>

            <Surface variant="default" className="p-5" as="div">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Absences
                </p>
                <XCircle className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-3xl font-extrabold tabular-nums text-rose-700">
                {absentCount.toLocaleString()}
              </p>
              <p className="mt-1.5 text-xs text-slate-500">
                {totalStudents > 0
                  ? `Across ${totalStudents} active learners`
                  : "Unexcused absences flagged"}
              </p>
            </Surface>
          </div>

          {/* Recent Sessions Breakdown */}
          <Surface variant="default" className="p-5 sm:p-6" as="div">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-slate-900">
                  Recent Class Roll Calls
                </h2>
                <p className="text-xs text-slate-500">
                  Session-by-session breakdown of attendance submission signals.
                </p>
              </div>
              <span className="text-xs font-medium text-slate-400">
                Showing recent {sessions.length} sessions
              </span>
            </div>

            {sessions.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="font-semibold text-slate-700">
                  No attendance sessions recorded yet
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  When teachers complete roll calls for their periods, summaries
                  will appear here.
                </p>
              </div>
            ) : (
              <div className="mt-5 divide-y divide-slate-100 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pr-4">Class</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Present</th>
                      <th className="pb-3 pr-4">Late</th>
                      <th className="pb-3 pr-4">Absent</th>
                      <th className="pb-3 text-right">Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sessions.map((session) => {
                      const sessionTotal =
                        session.present + session.late + session.absent + (session.excused || 0);
                      const sessionRate =
                        sessionTotal > 0
                          ? Math.round(
                              ((session.present + session.late) / sessionTotal) * 100,
                            )
                          : 0;

                      return (
                        <tr
                          key={session.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="py-3.5 pr-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
                              <span>{session.className}</span>
                            </div>
                          </td>
                          <td className="py-3.5 pr-4 tabular-nums text-slate-600">
                            {session.date}
                          </td>
                          <td className="py-3.5 pr-4">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />
                              {session.present}
                            </span>
                          </td>
                          <td className="py-3.5 pr-4">
                            {session.late > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <Clock className="h-3 w-3" />
                                {session.late}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 pr-4">
                            {session.absent > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                                <XCircle className="h-3 w-3" />
                                {session.absent}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 text-right">
                            <span
                              className={cn(
                                "inline-block rounded-md px-2 py-0.5 font-bold tabular-nums",
                                sessionRate >= 90
                                  ? "bg-emerald-50 text-emerald-700"
                                  : sessionRate >= 80
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {sessionRate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Surface>
        </>
      )}
    </div>
  );
}
