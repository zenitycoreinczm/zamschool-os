"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Lock,
  Search,
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
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { Surface } from "@/components/workspace/Surface";
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

const ALL_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

// Session type labels used for display — must include all timetable session types
// (Morning, Afternoon, Evening) so evening lessons resolve a matching dropdown option.
const SESSION_TYPES = ["Morning", "Afternoon", "Evening"] as const;

function windowBadge(status?: RollCallWindow["status"]) {
  switch (status) {
    case "open":
      return {
        badge: "border-emerald-200 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300/40",
        label: "Window open",
        icon: Clock,
      };
    case "late":
      return {
        badge: "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-400/40",
        label: "Late window",
        icon: AlertTriangle,
      };
    case "upcoming":
      return {
        badge: "border-sky-200 bg-sky-50 text-sky-800",
        label: "Upcoming",
        icon: Clock,
      };
    case "closed":
    case "wrong_day":
      return {
        badge: "border-slate-200 bg-slate-100 text-slate-600",
        label: "Window closed",
        icon: Lock,
      };
    default:
      return {
        badge: "border-slate-200 bg-slate-50 text-slate-600",
        label: "Scheduled",
        icon: Clock,
      };
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

  const setStudentStatus = (
    lessonId: string,
    studentId: string,
    status: AttendanceStatus,
  ) => {
    setExceptions((prev) => {
      const current = prev[lessonId] || {};
      const next = { ...current };
      if (status === "PRESENT") {
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
    toast.success("Marked all students present");
  };

  // Keyboard shortcut handler for fast marking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const firstOpenLesson = lessons.find((l) => l.window?.canMark);
        if (firstOpenLesson) {
          markAllPresent(firstOpenLesson.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  const heroStats = [
    {
      label: "Lessons today",
      value: lessons.length,
      hint: `${submittedCount} marked`,
      tone: "slate" as const,
    },
    {
      label: "Students total",
      value: totalStudents,
      hint: "Across all rosters",
      tone: "slate" as const,
    },
    {
      label: "Open now",
      value: openCount,
      hint: openCount > 0 ? "Active period window" : "None right now",
      tone: openCount > 0 ? ("emerald" as const) : ("slate" as const),
    },
    {
      label: "Late alert",
      value: lateCount,
      hint: lateCount > 0 ? "Threshold exceeded" : "On schedule",
      tone: lateCount > 0 ? ("amber" as const) : ("slate" as const),
    },
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <AdminPageHero
        eyebrow="Classroom"
        title="Roll Call"
        description="Mark attendance for each lesson period during its active window. Notifications are dispatched to linked parents instantly upon submission."
        descriptionExtra={
          <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-300">
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl+A
            </kbd>{" "}
            marks all present
          </span>
        }
        stats={heroStats}
        accent="slate"
        actions={
          <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 p-1.5 backdrop-blur">
            <CalendarDays className="ml-2 h-4 w-4 text-white/80" />
            <DateOnlyPicker
              value={date}
              onChange={setDate}
              label=""
              accent="slate"
            />
          </div>
        }
      />

      {lateCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 shadow-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-900">
              {lateCount} lesson{lateCount === 1 ? "" : "s"} past the 10-minute start threshold
            </p>
            <p className="mt-0.5 text-xs text-amber-800">
              Submit roll call now. School leadership receives an automated alert when a period starts without attendance.
            </p>
          </div>
        </div>
      ) : null}

      {loading ? (
        <Surface
          variant="dashed"
          className="flex min-h-48 items-center justify-center gap-3 py-16 text-sm text-slate-500"
        >
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          Loading today&apos;s lessons and rosters…
        </Surface>
      ) : lessons.length === 0 ? (
        <Surface variant="dashed" className="py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <UserCheck className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900">
            No lessons scheduled for this date
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Pick a different date or check your teaching timetable.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {lessons.map((lesson) => (
            <RollCallCard
              key={lesson.id}
              lesson={lesson}
              isExpanded={expanded.has(lesson.id)}
              onToggleExpand={() => {
                const next = new Set(expanded);
                if (next.has(lesson.id)) next.delete(lesson.id);
                else next.add(lesson.id);
                setExpanded(next);
              }}
              exceptions={exceptions[lesson.id] || {}}
              onSetStatus={(studentId, status) =>
                setStudentStatus(lesson.id, studentId, status)
              }
              onMarkAllPresent={() => markAllPresent(lesson.id)}
              onSubmit={() => void submitAttendance(lesson)}
              isSaving={saving === lesson.id}
              parentHealth={getLessonParentHealth(lesson.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RollCallCard({
  lesson,
  isExpanded,
  onToggleExpand,
  exceptions,
  onSetStatus,
  onMarkAllPresent,
  onSubmit,
  isSaving,
  parentHealth,
}: {
  lesson: Lesson;
  isExpanded: boolean;
  onToggleExpand: () => void;
  exceptions: Record<string, AttendanceStatus>;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
  onMarkAllPresent: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  parentHealth?: {
    linkedParents: number;
    totalStudents: number;
    hasAnyLinked: boolean;
  };
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>("ALL");

  const win = lesson.window;
  const canMark = win?.canMark !== false;
  const locked = !canMark;
  const badgeInfo = windowBadge(win?.status);
  const BadgeIcon = badgeInfo.icon;

  // Counts breakdown
  const counts = useMemo(() => {
    const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const student of lesson.roster) {
      const st = exceptions[student.id] || "PRESENT";
      summary[st] = (summary[st] || 0) + 1;
    }
    return summary;
  }, [lesson.roster, exceptions]);

  // Filtered roster
  const filteredRoster = useMemo(() => {
    let list = lesson.roster;
    if (statusFilter !== "ALL") {
      list = list.filter(
        (s) => (exceptions[s.id] || "PRESENT") === statusFilter,
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [lesson.roster, exceptions, statusFilter, search]);

  const willNotifyCount = parentHealth?.linkedParents ?? 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-150",
        win?.status === "late"
          ? "border-amber-300 ring-1 ring-amber-200"
          : win?.status === "open"
            ? "border-emerald-300 ring-1 ring-emerald-100"
            : "border-slate-200",
      )}
    >
      {/* Header Button */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/70 transition"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-950 text-base leading-snug">
              {lesson.subjectName}
            </p>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              {lesson.className}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                badgeInfo.badge,
              )}
            >
              <BadgeIcon className="h-3.5 w-3.5" />
              {win?.label || badgeInfo.label}
            </span>
            {lesson.hasSubmission ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                <Check className="h-3 w-3" />
                Saved
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {(lesson.startTime || "").slice(0, 5)} – {(lesson.endTime || "").slice(0, 5)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              {lesson.roster.length} students
            </span>
            {win?.message ? (
              <span className="text-slate-400">· {win.message}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Status summary pill */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
              {counts.PRESENT} Present
            </span>
            {counts.ABSENT > 0 ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700">
                {counts.ABSENT} Absent
              </span>
            ) : null}
            {counts.LATE > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                {counts.LATE} Late
              </span>
            ) : null}
            {counts.EXCUSED > 0 ? (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700">
                {counts.EXCUSED} Excused
              </span>
            ) : null}
          </div>

          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded Roster Body */}
      {isExpanded ? (
        <div className="border-t border-slate-100">
          {/* Toolbar */}
          <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Search & Filter pills */}
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student or adm #…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1">
                {(["ALL", ...ALL_STATUSES] as const).map((st) => {
                  const active = statusFilter === st;
                  const count =
                    st === "ALL" ? lesson.roster.length : counts[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[11px] font-semibold transition",
                        active
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                      )}
                    >
                      {st === "ALL" ? "All" : formatAttendanceStatusLabel(st)}{" "}
                      <span className="opacity-75">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {!locked ? (
                <button
                  type="button"
                  onClick={onMarkAllPresent}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  <Users className="h-3.5 w-3.5" />
                  Mark All Present
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                  <Lock className="h-3.5 w-3.5" />
                  Locked outside period window
                </span>
              )}
            </div>
          </div>

          {/* Student Roster Rows */}
          <div
            className={cn(
              "divide-y divide-slate-100 max-h-[32rem] overflow-y-auto",
              locked && "pointer-events-none opacity-60",
            )}
          >
            {filteredRoster.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No students match your filter or search query.
              </div>
            ) : (
              filteredRoster.map((student) => {
                const currentStatus = exceptions[student.id] || "PRESENT";
                const initials = student.displayName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={student.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-semibold text-xs text-slate-600">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {student.displayName}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {student.admissionNumber || "No adm #"}
                        </p>
                      </div>
                    </div>

                    {/* Segmented Status Selector */}
                    <div className="flex items-center rounded-xl border border-slate-200/90 bg-slate-50 p-1 gap-1">
                      {ALL_STATUSES.map((status) => {
                        const isSelected = currentStatus === status;
                        let activeColor = "bg-slate-800 text-white shadow-sm";
                        if (status === "PRESENT") activeColor = "bg-emerald-600 text-white font-bold shadow-sm";
                        if (status === "ABSENT") activeColor = "bg-rose-600 text-white font-bold shadow-sm";
                        if (status === "LATE") activeColor = "bg-amber-600 text-white font-bold shadow-sm";
                        if (status === "EXCUSED") activeColor = "bg-sky-600 text-white font-bold shadow-sm";

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => onSetStatus(student.id, status)}
                            disabled={locked}
                            className={cn(
                              "rounded-lg px-2.5 py-1 text-xs font-medium transition duration-150 min-w-[3rem]",
                              isSelected
                                ? activeColor
                                : "text-slate-600 hover:bg-white hover:text-slate-900",
                            )}
                          >
                            {status === "PRESENT" ? "Present" : status === "ABSENT" ? "Absent" : status === "LATE" ? "Late" : "Excused"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Notification & Submit */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
            <div className="flex items-center gap-2 text-xs">
              <Bell className="h-3.5 w-3.5 text-slate-400" />
              {!locked && willNotifyCount > 0 ? (
                <span className="text-slate-600">
                  Will notify <strong className="text-slate-900">{willNotifyCount}</strong> linked parents upon save
                </span>
              ) : !locked ? (
                <span className="text-amber-700 font-medium">
                  No linked parents found — link parents in admin first
                </span>
              ) : (
                <span className="text-slate-400">Read-only window</span>
              )}
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSaving || locked}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60",
                locked
                  ? "cursor-not-allowed bg-slate-400"
                  : win?.status === "late"
                    ? "bg-amber-600 hover:bg-amber-500"
                    : "bg-emerald-600 hover:bg-emerald-500",
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving roll call…
                </>
              ) : locked ? (
                <>
                  <Lock className="h-4 w-4" />
                  {win?.status === "upcoming" ? "Not open yet" : "Window closed"}
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
}
