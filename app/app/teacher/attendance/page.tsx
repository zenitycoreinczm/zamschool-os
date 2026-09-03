"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Lock,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatAttendanceStatusLabel } from "@/lib/attendance/status";
import {
  buildInitialRollCallState,
  mergeRollCallStateOnRefresh,
} from "@/lib/attendance/rollcall-state";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import { cn } from "@/lib/utils";

type LessonRoster = {
  id: string;
  profileId: string | null;
  admissionNumber: string | null;
  displayName: string;
  email: string | null;
  status: string | null;
  remarks: string | null;
};

type RollCallWindow = {
  status: "upcoming" | "open" | "late" | "closed" | "wrong_day";
  canMark: boolean;
  isLate: boolean;
  minutesUntilStart: number | null;
  minutesUntilEnd: number | null;
  minutesLate: number | null;
  label: string;
  message: string;
  schoolDate?: string;
  schoolTime?: string;
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
  hasSubmission?: boolean;
  submittedCount?: number;
  window?: RollCallWindow;
};

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const EXCEPTION_OPTIONS: AttendanceStatus[] = ["ABSENT", "LATE", "EXCUSED"];

const SESSION_TYPES = ["Morning", "Midday", "Afternoon", "Evening"] as const;

const STATUS_COLORS: Record<string, string> = {
  PRESENT: "bg-emerald-500 text-white shadow-sm",
  ABSENT: "bg-rose-500 text-white shadow-sm",
  LATE: "bg-amber-500 text-white shadow-sm",
  EXCUSED: "bg-sky-500 text-white shadow-sm",
};

function windowTone(status?: RollCallWindow["status"]) {
  switch (status) {
    case "open":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "late":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "upcoming":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "closed":
    case "wrong_day":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function TeacherAttendancePage() {
  const today = useMemo(() => {
    // Prefer local browser date for the picker default
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [date, setDate] = useState(today);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [exceptions, setExceptions] = useState<
    Record<string, Record<string, AttendanceStatus>>
  >({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [nowTick, setNowTick] = useState(0);

  // Refs so the silent background refresh can merge without clobbering
  // staged (unsaved) teacher edits.
  const exceptionsRef = useRef(exceptions);
  exceptionsRef.current = exceptions;
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const fetchLessons = useCallback(async (selectedDate: string) => {
    const body = await adminApiJson<{ success: boolean; data: Lesson[] }>(
      `/api/teacher/classes?date=${selectedDate}`,
    );
    return Array.isArray(body.data) ? body.data : [];
  }, []);

  const loadLessons = useCallback(
    async (selectedDate: string) => {
      setLoading(true);
      try {
        const items = await fetchLessons(selectedDate);
        setLessons(items);
        const state = buildInitialRollCallState(items);
        setExceptions(
          state.exceptions as Record<string, Record<string, AttendanceStatus>>,
        );
        setExpanded(state.expanded);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to load lessons";
        toast.error(message);
        setLessons([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchLessons],
  );

  // Background refresh: keeps countdown windows fresh without a loading
  // flash, and never overwrites staged marks or collapsed cards.
  const refreshLessonsSilently = useCallback(
    async (selectedDate: string) => {
      try {
        const items = await fetchLessons(selectedDate);
        const merged = mergeRollCallStateOnRefresh(
          exceptionsRef.current,
          expandedRef.current,
          items,
        );
        setLessons(items);
        setExceptions(
          merged.exceptions as Record<string, Record<string, AttendanceStatus>>,
        );
        setExpanded(merged.expanded);
      } catch {
        // Silent: keep showing the last known state.
      }
    },
    [fetchLessons],
  );

  useEffect(() => {
    void loadLessons(date);
  }, [date, loadLessons]);

  // Refresh window labels every 30s so countdown stays accurate.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setNowTick((n) => n + 1);
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Soft re-fetch when a lesson becomes open/late.
  useEffect(() => {
    if (nowTick === 0) return;
    void refreshLessonsSilently(date);
  }, [nowTick, date, refreshLessonsSilently]);

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

  const openCount = lessons.filter((l) => l.window?.canMark).length;
  const lateCount = lessons.filter((l) => l.window?.status === "late").length;
  const submittedCount = lessons.filter((l) => l.hasSubmission).length;

  // Parent link health: count students with linked parents per lesson
  const parentLinkHealth = useMemo(() => {
    return lessons.map((lesson) => {
      const linkedCount = lesson.roster.filter(
        (s) => s.profileId && s.status !== null,
      ).length;
      return {
        lessonId: lesson.id,
        linkedParents: linkedCount,
        totalStudents: lesson.roster.length,
        hasAnyLinked: linkedCount > 0,
      };
    });
  }, [lessons]);

  const getLessonParentHealth = useCallback(
    (lessonId: string) => {
      return parentLinkHealth.find((h) => h.lessonId === lessonId);
    },
    [parentLinkHealth],
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

  // Quick mark: select first N students as absent (common scenario)
  const quickMarkAbsent = (lessonId: string, count: number) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    
    setExceptions((prev) => {
      const current = prev[lessonId] || {};
      const next = { ...current };
      
      // Mark first N students as absent
      for (let i = 0; i < Math.min(count, lesson.roster.length); i++) {
        next[lesson.roster[i].id] = "ABSENT";
      }
      
      return { ...prev, [lessonId]: next };
    });
  };

  // Keyboard shortcut handler for fast marking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only when not in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Ctrl/Cmd + A = mark all present for first open lesson
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        const firstOpenLesson = lessons.find((l) => l.window?.canMark);
        if (firstOpenLesson) {
          markAllPresent(firstOpenLesson.id);
          toast.success(`Marked all present for ${firstOpenLesson.subjectName}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lessons]);

  const submitAttendance = async (lesson: Lesson) => {
    if (lesson.window && !lesson.window.canMark) {
      toast.error(lesson.window.message || "Roll call is not open for this period.");
      return;
    }

    const lessonExceptions = exceptions[lesson.id] || {};
    const statuses = lesson.roster.map((student) => ({
      studentId: student.id,
      status: lessonExceptions[student.id] || ("PRESENT" as AttendanceStatus),
    }));

    setSaving(lesson.id);
    try {
      const body = await adminApiJson<{
        success?: boolean;
        status?: string;
        queued?: boolean;
        error?: string;
        data?: {
          savedCount?: number;
          parentsNotified?: number;
          notificationsQueued?: number;
          notifyReason?: string | null;
          submittedLate?: boolean;
          offline?: boolean;
        } | null;
      }>("/api/teacher/attendance", {
        method: "POST",
        body: JSON.stringify({
          lessonId: lesson.id,
          date,
          statuses,
        }),
      });

      const payload =
        body?.data && typeof body.data === "object" ? body.data : null;
      const isQueued =
        body?.status === "queued" ||
        body?.queued === true ||
        payload?.offline === true;

      if (isQueued && !payload) {
        toast.success(
          `Roll call queued offline · ${statuses.length} records will sync when online`,
        );
      } else {
        const savedCount =
          typeof payload?.savedCount === "number"
            ? payload.savedCount
            : statuses.length;
        const parentsNotified =
          typeof payload?.parentsNotified === "number"
            ? payload.parentsNotified
            : 0;
        const notificationsQueued =
          typeof payload?.notificationsQueued === "number"
            ? payload.notificationsQueued
            : 0;
        toast.success(
          `Roll call saved · ${savedCount} records · ${parentsNotified} parents notified`,
        );
        if (payload?.submittedLate) {
          toast.message(
            "Submitted after the 10-minute late threshold — Head Teacher was notified.",
          );
        }
        if (parentsNotified === 0) {
          toast.message(
            payload?.notifyReason ||
              "No linked parents found for those students. Link parents in admin first.",
          );
        } else if (notificationsQueued > 0) {
          toast.info(`${notificationsQueued} notifications queued`);
        }
      }

      await refreshLessonsSilently(date);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save attendance";
      toast.error(message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-5 py-6 text-white shadow-lg md:px-7 md:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
              Classroom
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Roll Call</h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-300">
              Mark attendance only during each lesson window. Head Teacher is
              alerted if roll call is not started within 10 minutes of the period
              start.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px]">
                Ctrl+A
              </kbd>{" "}
              = mark all present for first open lesson
            </p>
          </div>
          <div className="w-full max-w-[200px] rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-100/80">
              <CalendarDays className="h-3.5 w-3.5" />
              Date
            </p>
            <DateOnlyPicker
              value={date}
              onChange={setDate}
              label=""
              accent="slate"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill label="Lessons" value={lessons.length} />
          <StatPill label="Students" value={totalStudents} />
          <StatPill label="Open now" value={openCount} tone="good" />
          <StatPill
            label="Late windows"
            value={lateCount}
            tone={lateCount > 0 ? "warn" : "neutral"}
          />
        </div>
      </section>

      {lateCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">
              {lateCount} lesson{lateCount === 1 ? "" : "s"} past the 10-minute
              start threshold
            </p>
            <p className="mt-0.5 text-xs text-amber-800/90">
              Submit roll call now. Head Teacher receives a lateness alert when
              a period has no roll call after 10 minutes.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          Loading lessons and rosters...
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
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              {submittedCount} of {lessons.length} lessons already have roll call
              saved
              {exceptionCount > 0 ? ` · ${exceptionCount} exceptions staged` : ""}
            </p>
          </div>

          {lessons.map((lesson) => {
            const lessonExceptions = exceptions[lesson.id] || {};
            const exceptionKeys = Object.keys(lessonExceptions);
            const isExpanded = expanded.has(lesson.id);
            const win = lesson.window;
            const canMark = win?.canMark !== false;
            const locked = !canMark;

            return (
              <div
                key={lesson.id}
                className={cn(
                  "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
                  win?.status === "late"
                    ? "border-amber-300 ring-1 ring-amber-100"
                    : win?.status === "open"
                      ? "border-emerald-200"
                      : "border-slate-200",
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(expanded);
                    if (isExpanded) next.delete(lesson.id);
                    else next.add(lesson.id);
                    setExpanded(next);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-slate-50/80"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">
                        {lesson.subjectName}
                      </p>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          windowTone(win?.status),
                        )}
                      >
                        {win?.status === "closed" || win?.status === "wrong_day" ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {win?.label || "—"}
                      </span>
                      {lesson.hasSubmission ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" />
                          Saved
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {lesson.className} · {lesson.startTime?.slice(0, 5)}–
                      {lesson.endTime?.slice(0, 5)} · {lesson.roster.length}{" "}
                      students
                    </p>
                    {win?.message ? (
                      <p className="mt-1 text-[11px] text-slate-400">{win.message}</p>
                    ) : null}
                    {/* Parent link health indicator */}
                    {(() => {
                      const health = getLessonParentHealth(lesson.id);
                      if (health && !health.hasAnyLinked) {
                        return (
                          <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600">
                            <AlertTriangle className="h-3 w-3" />
                            No parents linked — notifications won&apos;t be sent
                          </p>
                        );
                      } else if (health && health.linkedParents < health.totalStudents) {
                        return (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {health.linkedParents}/{health.totalStudents} students have linked parents
                          </p>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {exceptionKeys.length === 0 ? (
                      <span className="hidden text-xs font-medium text-emerald-600 sm:inline">
                        All present
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
                      <button
                        type="button"
                        onClick={() => markAllPresent(lesson.id)}
                        disabled={locked}
                        className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Users className="mr-1 inline h-3 w-3" />
                        Mark All Present
                      </button>
                      {/* Quick mark buttons for common scenarios */}
                      {!locked && (
                        <>
                          <button
                            type="button"
                            onClick={() => quickMarkAbsent(lesson.id, 1)}
                            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            title="Quick mark 1 student absent"
                          >
                            -1 Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => quickMarkAbsent(lesson.id, 2)}
                            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            title="Quick mark 2 students absent"
                          >
                            -2 Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => quickMarkAbsent(lesson.id, 3)}
                            className="inline-flex min-h-[44px] items-center rounded-md px-3 text-xs font-medium text-rose-600 hover:bg-rose-50"
                            title="Quick mark 3 students absent"
                          >
                            -3 Absent
                          </button>
                        </>
                      )}
                      {locked ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Lock className="h-3 w-3" />
                          Editing locked outside the period window
                        </span>
                      ) : null}
                    </div>

                    <div
                      className={cn(
                        "divide-y divide-slate-100",
                        locked && "pointer-events-none opacity-60",
                      )}
                    >
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
                                {student.admissionNumber || "-"}
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
                                      className={`inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-semibold transition-all ${
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
                                  className="inline-flex min-h-[44px] items-center rounded-lg bg-emerald-100 px-3 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-200"
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
                                  aria-label={`Revert ${student.displayName} to present`}
                                  title="Revert to Present"
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                      {(() => {
                        const health = getLessonParentHealth(lesson.id);
                        const willNotifyCount = health?.linkedParents || 0;
                        const totalCount = health?.totalStudents || lesson.roster.length;
                        
                        return (
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => void submitAttendance(lesson)}
                              disabled={saving === lesson.id || locked}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60",
                                locked
                                  ? "cursor-not-allowed bg-slate-400"
                                  : win?.status === "late"
                                    ? "bg-amber-500 hover:bg-amber-400"
                                    : "bg-emerald-600 hover:bg-emerald-500",
                              )}
                            >
                              {saving === lesson.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Saving...
                                </>
                              ) : locked ? (
                                <>
                                  <Lock className="h-4 w-4" />
                                  {win?.status === "upcoming"
                                    ? "Not open yet"
                                    : "Window closed"}
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  Submit Roll Call
                                </>
                              )}
                            </button>
                            
                            {/* Parent notification preview */}
                            {!locked && willNotifyCount > 0 && (
                              <span className="text-xs text-emerald-700">
                                Will notify {willNotifyCount} parent{willNotifyCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {!locked && willNotifyCount === 0 && totalCount > 0 && (
                              <span className="text-xs text-amber-700">
                                No parents linked — link in admin first
                              </span>
                            )}
                          </div>
                        );
                      })()}
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

function StatPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2.5",
        tone === "good"
          ? "border-emerald-400/30 bg-emerald-400/10"
          : tone === "warn"
            ? "border-amber-300/40 bg-amber-400/10"
            : "border-white/10 bg-white/5",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}
