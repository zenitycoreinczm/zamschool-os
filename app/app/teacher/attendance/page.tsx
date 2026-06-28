"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatAttendanceStatusLabel } from "@/lib/attendance/status";

type LessonRoster = {
  id: string;
  profileId: string | null;
  admissionNumber: string | null;
  displayName: string;
  email: string | null;
  status: string | null;
  remarks: string | null;
};

type Lesson = {
  id: string;
  date: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  startTime: string;
  endTime: string;
  rosterCount: number;
  roster: LessonRoster[];
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const EXCEPTION_OPTIONS: AttendanceStatus[] = ["ABSENT", "LATE", "EXCUSED"];

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white shadow-sm",
  ABSENT: "bg-rose-500 text-white shadow-sm",
  LATE: "bg-amber-500 text-white shadow-sm",
  EXCUSED: "bg-sky-500 text-white shadow-sm",
};

const SESSION_TYPES = [
  "Morning",
  "Afternoon",
  "Evening",
  "Period 1",
  "Period 2",
  "Period 3",
  "Period 4",
  "Period 5",
  "Period 6",
  "Period 7",
  "Period 8",
];

export default function TeacherAttendancePage() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<
    Record<string, Record<string, AttendanceStatus>>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sessionTypes, setSessionTypes] = useState<Record<string, string>>({});

  const loadLessons = useCallback(async (selectedDate: string) => {
    setLoading(true);
    try {
      const body = await adminApiJson<{ success: boolean; data: Lesson[] }>(
        `/api/teacher/classes?date=${selectedDate}`,
      );
      const items = Array.isArray(body.data) ? body.data : [];
      setLessons(items);

      const initialExceptions: Record<
        string,
        Record<string, AttendanceStatus>
      > = {};
      const expandedSet = new Set<string>();
      const sessionMap: Record<string, string> = {};

      for (const lesson of items) {
        expandedSet.add(lesson.id);
        const lessonExceptions: Record<string, AttendanceStatus> = {};
        for (const student of lesson.roster) {
          if (student.status && student.status !== "PRESENT") {
            lessonExceptions[student.id] = student.status as AttendanceStatus;
          }
        }
        initialExceptions[lesson.id] = lessonExceptions;
        sessionMap[lesson.id] = detectSessionType(lesson.startTime);
      }
      setExceptions(initialExceptions);
      setExpanded(expandedSet);
      setSessionTypes(sessionMap);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load lessons";
      toast.error(message);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLessons(date);
  }, [date, loadLessons]);

  const totalStudents = useMemo(
    () => lessons.reduce((sum, lesson) => sum + lesson.roster.length, 0),
    [lessons],
  );

  const exceptionCount = useMemo(
    () =>
      Object.values(exceptions).reduce(
        (sum, lessonExceptions) => sum + Object.keys(lessonExceptions).length,
        0,
      ),
    [exceptions],
  );

  const toggleException = (
    lessonId: string,
    studentId: string,
    status: AttendanceStatus,
  ) => {
    setExceptions((prev) => {
      const current = prev[lessonId] || {};
      const next = { ...current };
      if (next[studentId] === status) {
        delete next[studentId];
      } else {
        next[studentId] = status;
      }
      return { ...prev, [lessonId]: next };
    });
  };

  const markAllPresent = (lessonId: string) => {
    setExceptions((prev) => {
      const next = { ...prev };
      delete next[lessonId];
      return next;
    });
  };

  const submitAttendance = async (lesson: Lesson) => {
    const lessonExceptions = exceptions[lesson.id] || {};
    const statuses = lesson.roster.map((student) => ({
      studentId: student.id,
      status: lessonExceptions[student.id] || ("PRESENT" as AttendanceStatus),
    }));

    setSaving(lesson.id);
    try {
      const body = await adminApiJson<{
        success: boolean;
        data: {
          savedCount: number;
          parentsNotified: number;
          notificationsQueued: number;
        };
      }>("/api/teacher/attendance", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          date,
          session_type: sessionTypes[lesson.id] || null,
          statuses,
        }),
      });

      const { savedCount, parentsNotified, notificationsQueued } = body.data;
      toast.success(
        `Roll call saved · ${savedCount} records · ${parentsNotified} parents notified`,
      );

      if (notificationsQueued > 0) {
        toast.info(`${notificationsQueued} notifications queued`);
      }

      // Refresh the roster so saved statuses are reflected in the UI
      await loadLessons(date);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save attendance";
      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Roll Call</h1>
          <p className="text-sm text-slate-500">
            {totalStudents} students across {lessons.length} classes
            {exceptionCount > 0 && ` · ${exceptionCount} exceptions`}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-0 bg-transparent p-0 text-sm font-medium text-slate-700 outline-none"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          Loading lessons and rosters…
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center">
          <UserCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            No lessons scheduled for this date
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Select a different date or check your timetable.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => {
            const lessonExceptions = exceptions[lesson.id] || {};
            const exceptionKeys = Object.keys(lessonExceptions);
            const isExpanded = expanded.has(lesson.id);

            return (
              <div
                key={lesson.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(expanded);
                    if (isExpanded) next.delete(lesson.id);
                    else next.add(lesson.id);
                    setExpanded(next);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {lesson.subjectName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {lesson.className} · {lesson.startTime?.slice(0, 5)}–
                      {lesson.endTime?.slice(0, 5)} · {lesson.roster.length}{" "}
                      students
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exceptionKeys.length === 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        <Check className="h-3 w-3" />
                        All Present
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600">
                        {exceptionKeys.length} exception
                        {exceptionKeys.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded ? (
                  <div className="border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5">
                      <span className="mr-1 text-xs font-medium text-slate-500">
                        Session:
                      </span>
                      <select
                        value={sessionTypes[lesson.id] || ""}
                        onChange={(e) =>
                          setSessionTypes((prev) => ({
                            ...prev,
                            [lesson.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {SESSION_TYPES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <span className="mx-2 text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => markAllPresent(lesson.id)}
                        className="rounded-md px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                      >
                        <Users className="mr-1 inline h-3 w-3" />
                        Mark All Present
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {lesson.roster.map((student) => {
                        const currentStatus =
                          lessonExceptions[student.id] || "PRESENT";
                        const isException = !!lessonExceptions[student.id];
                        return (
                          <div
                            key={student.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900">
                                {student.displayName}
                              </p>
                              <p className="text-xs text-slate-400">
                                {student.admissionNumber || "—"}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {isException ? (
                                EXCEPTION_OPTIONS.map((status) => {
                                  const active = currentStatus === status;
                                  return (
                                    <button
                                      key={status}
                                      type="button"
                                      onClick={() =>
                                        toggleException(
                                          lesson.id,
                                          student.id,
                                          status,
                                        )
                                      }
                                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                                        active
                                          ? STATUS_COLORS[status]
                                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                      }`}
                                    >
                                      {formatAttendanceStatusLabel(status)}
                                    </button>
                                  );
                                })
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleException(
                                      lesson.id,
                                      student.id,
                                      "ABSENT",
                                    )
                                  }
                                  className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-200"
                                >
                                  {formatAttendanceStatusLabel(currentStatus)}
                                </button>
                              )}
                              {isException && currentStatus !== "PRESENT" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleException(
                                      lesson.id,
                                      student.id,
                                      currentStatus,
                                    )
                                  }
                                  className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500 hover:bg-emerald-100 hover:text-emerald-600"
                                  title="Revert to Present"
                                >
                                  ✓
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => submitAttendance(lesson)}
                        disabled={saving === lesson.id}
                        className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-400 disabled:opacity-60"
                      >
                        {saving === lesson.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4" />
                            Submit Roll Call
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function detectSessionType(startTime: string | null): string {
  if (!startTime) return "Morning";
  const hour = parseInt(startTime.split(":")[0] || "0", 10);
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}
