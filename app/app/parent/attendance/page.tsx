"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildAttendanceColor } from "@/lib/attendance/analytics";

type AttendanceRow = {
  id: string;
  date: string;
  status: string;
  subjectName: string;
  childName: string;
  studentId: string;
  className: string | null;
};

type ChildSummary = {
  id: string;
  displayName: string;
  attendanceRate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function ParentAttendancePage() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const loadKey = useRef(0);

  useEffect(() => {
    const loadChildren = async () => {
      const res = await fetch("/api/parent/children");

      if (res.ok) {
        const body = await res.json();
        setChildren(body.data ?? []);
      }
    };

    void loadChildren();
  }, []);

  useEffect(() => {
    const current = ++loadKey.current;

    const load = async () => {
      const params = selectedChild ? `?studentId=${selectedChild}` : "";
      const res = await fetch(`/api/parent/attendance${params}`);

      if (current !== loadKey.current) return;

      if (!res.ok) {
        setError("Failed to load attendance");
        setLoading(false);
        return;
      }

      const body = await res.json();
      const data = body.data ?? body;
      const attendanceRows =
        data.rows ?? data.children?.flatMap((c: any) => c.rows ?? []) ?? [];
      if (current === loadKey.current) {
        setRows(attendanceRows);
        setLoading(false);
      }
    };

    void load();
  }, [selectedChild]);

  const handleChildChange = (childId: string) => {
    setLoading(true);
    setError("");
    setSelectedChild(childId);
  };

  const childSummaries = useMemo(() => {
    const map = new Map<string, ChildSummary>();
    for (const row of rows) {
      const sid = row.studentId;
      if (!sid) continue;
      const existing = map.get(sid) || {
        id: sid,
        displayName: row.childName || "Student",
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        attendanceRate: 0,
      };
      existing.total += 1;
      const status = row.status?.toUpperCase() || "";
      if (status === "PRESENT") existing.present += 1;
      else if (status === "ABSENT") existing.absent += 1;
      else if (status === "LATE") existing.late += 1;
      else if (status === "EXCUSED") existing.excused += 1;
      existing.attendanceRate =
        existing.total > 0
          ? Math.round((existing.present / existing.total) * 100)
          : 0;
      map.set(sid, existing);
    }
    return Array.from(map.values());
  }, [rows]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const statusByDate = new Map<string, string>();
    for (const row of rows) {
      const dateStr = row.date?.slice(0, 10);
      if (dateStr) {
        statusByDate.set(dateStr, row.status?.toUpperCase() || "");
      }
    }

    const days: Array<{ day: number; date: string; status: string }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        day: d,
        date: dateStr,
        status: statusByDate.get(dateStr) || "",
      });
    }

    return { firstDay, days };
  }, [calendarDate, rows]);

  if (loading) return <WorkspaceLoader label="Loading attendance" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Attendance</h1>
          <p className="text-sm text-slate-500">
            Your children&apos;s attendance records
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "px-3 py-1.5 font-medium transition",
                viewMode === "calendar"
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Calendar
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "px-3 py-1.5 font-medium transition",
                viewMode === "list"
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              List
            </button>
          </div>
          {children.length > 1 && (
            <select
              value={selectedChild}
              onChange={(e) => handleChildChange(e.target.value)}
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
      </div>

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        </Surface>
      ) : rows.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No attendance records found.
          </p>
        </Surface>
      ) : (
        <>
          {childSummaries.map((child) => (
            <Surface key={child.id} variant="elevated" className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-800">
                    {child.displayName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">
                      {child.attendanceRate}%
                    </p>
                    <p className="text-xs text-slate-500">Attendance</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600">
                      {child.present}
                    </p>
                    <p className="text-xs text-slate-500">Present</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-rose-600">
                      {child.absent}
                    </p>
                    <p className="text-xs text-slate-500">Absent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-amber-600">
                      {child.late}
                    </p>
                    <p className="text-xs text-slate-500">Late</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-sky-600">
                      {child.excused}
                    </p>
                    <p className="text-xs text-slate-500">Excused</p>
                  </div>
                </div>
              </div>
            </Surface>
          ))}

          {viewMode === "calendar" ? (
            <Surface variant="elevated" className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  onClick={() =>
                    setCalendarDate(
                      new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() - 1,
                        1,
                      ),
                    )
                  }
                  className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  &larr; Prev
                </button>
                <h3 className="text-base font-semibold text-slate-700">
                  {MONTH_NAMES[calendarDate.getMonth()]}{" "}
                  {calendarDate.getFullYear()}
                </h3>
                <button
                  onClick={() =>
                    setCalendarDate(
                      new Date(
                        calendarDate.getFullYear(),
                        calendarDate.getMonth() + 1,
                        1,
                      ),
                    )
                  }
                  className="rounded-lg px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Next &rarr;
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: calendarDays.firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {calendarDays.days.map((day) => (
                  <div
                    key={day.date}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg text-sm font-medium",
                      day.status
                        ? cn(buildAttendanceColor(day.status), "text-white")
                        : "bg-slate-50 text-slate-400",
                    )}
                    title={`${day.date}: ${day.status || "No record"}`}
                  >
                    {day.day}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-emerald-500" />{" "}
                  Present
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-rose-500" />{" "}
                  Absent
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-amber-400" />{" "}
                  Late
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-sky-400" />{" "}
                  Excused
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-slate-50 border border-slate-200" />{" "}
                  No record
                </span>
              </div>
            </Surface>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Child
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row: any) => (
                    <tr key={row.id} className="bg-white">
                      <td className="px-4 py-3 text-slate-900">{row.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {row.childName || row.studentName || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.subjectName || "\u2014"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                            row.status === "PRESENT" &&
                              "border-emerald-300 bg-emerald-50 text-emerald-700",
                            row.status === "ABSENT" &&
                              "border-rose-300 bg-rose-50 text-rose-700",
                            row.status === "LATE" &&
                              "border-amber-300 bg-amber-50 text-amber-700",
                            row.status === "EXCUSED" &&
                              "border-blue-300 bg-blue-50 text-blue-700",
                            !["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(
                              row.status,
                            ) && "border-slate-200 bg-white text-slate-600",
                          )}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
