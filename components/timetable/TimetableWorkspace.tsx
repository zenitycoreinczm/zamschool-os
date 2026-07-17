"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { fetchGatewayRead } from "@/lib/gateway-read-client";
import { getDisplayName } from "@/lib/profile-utils";
import { schoolLinkUserMessage } from "@/lib/school-access-error";
import { cn } from "@/lib/utils";

import {
  buildMobileDaySections,
  buildNextUpLessons,
  buildTeacherAliasMap,
  getDayFullLabel,
  getTodayDayKey,
  toMinutes,
  type LessonCardView,
  type TimetableLesson,
} from "@/lib/timetable-workspace";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { normalizeRole } from "@/lib/roles";

export type TimetableViewMode = "class" | "teacher" | "self";

type SelectOpt = { id: string; name: string };
type TeacherOpt = {
  id: string;
  name: string;
  role_record_id?: string | null;
};
type LessonForm = {
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
};

const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
];

const FALLBACK_TIME_CHOICES = buildTimeChoices("06:00", "20:00", 5);

const EMPTY_FORM: LessonForm = {
  class_id: "",
  subject_id: "",
  teacher_id: "",
  day_of_week: "1",
  start_time: "08:00",
  end_time: "09:00",
};

type SchoolDayHoursView = {
  schoolOpensAt: string;
  classesStartAt: string;
  classesEndAt: string;
  schoolClosesAt: string;
  classWindowLabel?: string;
};

export function TimetableWorkspace({
  viewMode,
}: {
  viewMode: TimetableViewMode;
}) {
  const { data: wsData, loading: workspaceLoading } = useWorkspaceContext();
  const currentUserId = wsData?.userId || null;
  const workspaceSchoolId = String(wsData?.schoolId || "").trim() || null;
  const role = normalizeRole(wsData?.role);
  // Teachers (self view) and Deputy Head (review only) cannot create/edit lessons.
  const readOnly = viewMode === "self" || role === "DEPUTY_HEAD";
  const canEdit = !readOnly;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [classes, setClasses] = useState<SelectOpt[]>([]);
  const [subjects, setSubjects] = useState<SelectOpt[]>([]);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [lessons, setLessons] = useState<TimetableLesson[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [teacherQuery, setTeacherQuery] = useState("");
  const [form, setForm] = useState<LessonForm>(EMPTY_FORM);
  const [openForm, setOpenForm] = useState(false);
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);
  const [schoolHours, setSchoolHours] = useState<SchoolDayHoursView | null>(
    null,
  );

  const timeChoices = useMemo(() => {
    if (!schoolHours?.classesStartAt || !schoolHours?.classesEndAt) {
      return FALLBACK_TIME_CHOICES;
    }
    // Pad slightly so academic staff can schedule early assembly / late clubs.
    const startPad = subtractClock(schoolHours.schoolOpensAt || schoolHours.classesStartAt, 30) ||
      schoolHours.classesStartAt;
    const endPad =
      addClock(schoolHours.schoolClosesAt || schoolHours.classesEndAt, 30) ||
      schoolHours.classesEndAt;
    return buildTimeChoices(startPad, endPad, 5);
  }, [schoolHours]);

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((x) => [x.id, x.name])),
    [subjects],
  );
  const classMap = useMemo(
    () => Object.fromEntries(classes.map((x) => [x.id, x.name])),
    [classes],
  );
  const teacherMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const teacher of teachers) {
      if (teacher.id) map[teacher.id] = teacher.name;
      if (teacher.role_record_id) map[teacher.role_record_id] = teacher.name;
    }
    return map;
  }, [teachers]);

  const teacherAliases = useMemo(
    () => buildTeacherAliasMap(teachers),
    [teachers],
  );

  const activeTeacherId =
    viewMode === "self"
      ? currentUserId || "all"
      : viewMode === "teacher" && selectedTeacher
        ? selectedTeacher
        : "all";

  const weekSections = useMemo(
    () =>
      buildMobileDaySections({
        lessons,
        selectedClass: viewMode === "class" ? selectedClass : "all",
        selectedTeacher: activeTeacherId,
        classMap,
        subjectMap,
        teacherMap,
        teacherAliases,
      }),
    [
      lessons,
      viewMode,
      selectedClass,
      activeTeacherId,
      classMap,
      subjectMap,
      teacherMap,
      teacherAliases,
    ],
  );

  // Always show Mon–Fri columns (including empty days) for a stable glance grid.
  const weekColumns = useMemo(() => {
    const byDay = new Map(weekSections.map((s) => [s.key, s.lessons]));
    return DAY_OPTIONS.map((day) => ({
      key: Number(day.value),
      label: day.label.slice(0, 3),
      fullLabel: day.label,
      lessons: byDay.get(Number(day.value)) || [],
    }));
  }, [weekSections]);

  const totalInView = useMemo(
    () => weekColumns.reduce((sum, d) => sum + d.lessons.length, 0),
    [weekColumns],
  );

  const nextUp = useMemo(
    () =>
      buildNextUpLessons(
        lessons,
        {
          classMap,
          subjectMap,
          teacherMap,
          selectedClass: viewMode === "class" ? selectedClass : "all",
          selectedTeacher: activeTeacherId,
          teacherAliases,
        },
        4,
      ),
    [
      lessons,
      classMap,
      subjectMap,
      teacherMap,
      viewMode,
      selectedClass,
      activeTeacherId,
      teacherAliases,
    ],
  );

  const teacherLessonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lesson of lessons) {
      const keys = new Set<string>();
      if (lesson.teacher_id) keys.add(lesson.teacher_id);
      if (lesson.teacher_profile_id) keys.add(lesson.teacher_profile_id);
      const aliases = teacherAliases.get(String(lesson.teacher_id || ""));
      if (aliases) for (const key of aliases) keys.add(key);
      for (const key of keys) {
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return counts;
  }, [lessons, teacherAliases]);

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [teachers, teacherQuery]);

  const detailLesson = detailLessonId
    ? (lessons.find((x) => x.id === detailLessonId) ?? null)
    : null;
  const detailCard = useMemo(() => {
    if (!detailLesson) return null;
    const flat = weekColumns.flatMap((d) => d.lessons);
    return flat.find((c) => c.id === detailLesson.id) || null;
  }, [detailLesson, weekColumns]);

  const cardLens = viewMode === "class" ? "teacher" : "class";
  const todayKey = getTodayDayKey();

  const title =
    viewMode === "teacher" && selectedTeacher
      ? teacherMap[selectedTeacher] || "Teacher schedule"
      : viewMode === "class"
        ? selectedClass === "all"
          ? "Class schedules"
          : classMap[selectedClass] || "Class schedule"
        : viewMode === "self"
          ? "My teaching week"
          : "Teacher schedules";

  useEffect(() => {
    if (workspaceLoading && !workspaceSchoolId) return;

    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        let sid = workspaceSchoolId;
        if (!sid) {
          const schoolBody = await adminApiJson<{
            data?: { profile?: { school_id?: string | null } };
          }>("/api/admin/school");
          sid =
            String(schoolBody.data?.profile?.school_id || "").trim() || null;
        }
        if (!sid) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const retryBody = await adminApiJson<{
            data?: { profile?: { school_id?: string | null } };
          }>("/api/admin/school");
          sid =
            String(retryBody.data?.profile?.school_id || "").trim() || null;
        }
        if (!sid) throw new Error(schoolLinkUserMessage());
        if (cancelled) return;
        setSchoolId(sid);
        // School day hours (Head Teacher) guide timetable start/end choices.
        try {
          const hoursBody = await adminApiJson<{ data?: SchoolDayHoursView }>(
            "/api/admin/school-hours",
            { cache: "no-store" },
          );
          if (!cancelled && hoursBody.data?.classesStartAt) {
            setSchoolHours(hoursBody.data);
            setForm((prev) => {
              if (prev.class_id || prev.subject_id) return prev;
              const start = hoursBody.data!.classesStartAt.slice(0, 5);
              const end =
                addClock(start, 60) ||
                hoursBody.data!.classesEndAt.slice(0, 5);
              return { ...prev, start_time: start, end_time: end };
            });
          }
        } catch {
          // Defaults remain usable if hours endpoint fails.
        }
        await fetchAll();
      } catch (err: unknown) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load timetable",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void init();
    return () => {
      cancelled = true;
    };
  }, [workspaceLoading, workspaceSchoolId]);

  async function fetchAll(options: { lessonsOnly?: boolean } = {}) {
    // Always no-store so create/delete is not masked by browser/gateway cache.
    const fetchInit = { cache: "no-store" as RequestCache };

    if (options.lessonsOnly) {
      // Cache-buster avoids inflight GET dedupe / stale intermediary caches.
      const lessonsBody = await adminApiJson<{
        data?: TimetableLesson[];
        success?: boolean;
      }>(`/api/admin/timetable?_ts=${Date.now()}`, fetchInit);
      const rawLessons = Array.isArray(lessonsBody?.data)
        ? lessonsBody.data
        : Array.isArray(lessonsBody)
          ? lessonsBody
          : [];
      setLessons(rawLessons as TimetableLesson[]);
      return;
    }

    const [classesRes, subjectRes, teacherRes, lessonsBody] = await Promise.all(
      [
        fetchGatewayRead("/api/admin/classes", {
          cache: "no-store",
          fallbackToLocal: true,
        }),
        adminApiJson<{ data?: SelectOpt[] }>("/api/admin/subjects", fetchInit),
        adminApiJson<{ data?: { teachers?: unknown[] } }>(
          "/api/admin/users",
          fetchInit,
        ),
        adminApiJson<{ data?: TimetableLesson[]; success?: boolean }>(
          "/api/admin/timetable",
          fetchInit,
        ),
      ],
    );
    const classesBody = await classesRes.json();
    if (!classesRes.ok) {
      throw new Error(classesBody?.error || "Failed to load classes");
    }
    const nextClasses = toClassOptions(classesBody?.data);
    const nextSubjects = (subjectRes.data || []).map((x) => ({
      id: x.id,
      name: x.name,
    }));
    const nextTeachers = (teacherRes.data?.teachers || []).map((x: unknown) => {
      const row = x as Record<string, unknown>;
      const profileId = String(row.id || row.profile_id || "").trim();
      const roleRecordId = String(
        row.role_record_id || row.teacher_row_id || "",
      ).trim();
      return {
        id: profileId,
        name: getDisplayName(row),
        role_record_id: roleRecordId || null,
      } satisfies TeacherOpt;
    });
    setClasses(nextClasses);
    setSubjects(nextSubjects);
    setTeachers(nextTeachers);
    const rawLessons = Array.isArray(lessonsBody?.data)
      ? lessonsBody.data
      : Array.isArray(lessonsBody)
        ? lessonsBody
        : [];
    setLessons(rawLessons as TimetableLesson[]);
    setForm((prev) => ({
      ...prev,
      class_id: prev.class_id || nextClasses[0]?.id || "",
      subject_id: prev.subject_id || nextSubjects[0]?.id || "",
      teacher_id: prev.teacher_id || nextTeachers[0]?.id || "",
    }));
  }

  function mapCreatedLesson(
    data: Record<string, unknown> | null | undefined,
    draft: {
      classId: string;
      subjectId: string;
      teacherProfileId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    },
  ): TimetableLesson | null {
    if (!data || !data.id) {
      // Still paint a temporary row so the board never feels stuck.
      const tempId = `temp-${Date.now()}`;
      return {
        id: tempId,
        title: subjectMap[draft.subjectId] || "Lesson",
        subject_id: draft.subjectId,
        class_id: draft.classId,
        teacher_id:
          teachers.find((t) => t.id === draft.teacherProfileId)
            ?.role_record_id || draft.teacherProfileId,
        teacher_profile_id: draft.teacherProfileId,
        day_of_week: draft.dayOfWeek,
        start_time: draft.startTime,
        end_time: draft.endTime,
      };
    }

    const teacherRowId = String(
      data.teacher_id || data.teacher_row_id || "",
    ).trim();
    const teacherProfileId = String(
      data.teacher_profile_id || draft.teacherProfileId || "",
    ).trim();

    return {
      id: String(data.id),
      title:
        (data.title as string | null) ||
        subjectMap[String(data.subject_id || draft.subjectId)] ||
        "Lesson",
      subject_id: String(data.subject_id || draft.subjectId),
      class_id: String(data.class_id || draft.classId),
      teacher_id: teacherRowId || draft.teacherProfileId,
      teacher_profile_id: teacherProfileId || null,
      day_of_week: Number(data.day_of_week ?? draft.dayOfWeek),
      start_time: normalizeTimeValue(
        String(data.start_time || draft.startTime),
      ),
      end_time: normalizeTimeValue(String(data.end_time || draft.endTime)),
    };
  }

  function openAddLesson() {
    if (!canEdit) return;
    const defaultStart =
      schoolHours?.classesStartAt?.slice(0, 5) || EMPTY_FORM.start_time;
    const defaultEnd =
      addClock(defaultStart, 60) ||
      schoolHours?.classesEndAt?.slice(0, 5) ||
      EMPTY_FORM.end_time;
    setForm((prev) => ({
      ...prev,
      class_id:
        viewMode === "class" && selectedClass !== "all"
          ? selectedClass
          : prev.class_id || classes[0]?.id || "",
      teacher_id:
        viewMode === "teacher" && selectedTeacher
          ? selectedTeacher
          : prev.teacher_id || teachers[0]?.id || "",
      subject_id: prev.subject_id || subjects[0]?.id || "",
      start_time: prev.start_time || defaultStart,
      end_time: prev.end_time || defaultEnd,
    }));
    setOpenForm(true);
  }

  async function createLesson() {
    if (!canEdit || !schoolId) return;
    if (!form.class_id || !form.subject_id || !form.teacher_id) {
      toast.error("Class, subject, and teacher are required");
      return;
    }
    const startTime = normalizeTimeValue(form.start_time);
    const endTime = normalizeTimeValue(form.end_time);

    if (toMinutes(endTime) <= toMinutes(startTime)) {
      toast.error("End time must be after start time");
      return;
    }
    if (schoolHours?.classesStartAt && schoolHours?.classesEndAt) {
      const classStart = toMinutes(schoolHours.classesStartAt);
      const classEnd = toMinutes(schoolHours.classesEndAt);
      if (
        Number.isFinite(classStart) &&
        Number.isFinite(classEnd) &&
        (toMinutes(startTime) < classStart || toMinutes(endTime) > classEnd)
      ) {
        toast.info(
          `Note: school classes are set for ${schoolHours.classesStartAt.slice(0, 5)}–${schoolHours.classesEndAt.slice(0, 5)}. You can still save outside that window if needed.`,
        );
      }
    }
    setSaving(true);
    const toastId = toast.loading("Saving lesson...");
    const draft = {
      classId: form.class_id,
      subjectId: form.subject_id,
      teacherProfileId: form.teacher_id,
      dayOfWeek: Number(form.day_of_week),
      startTime,
      endTime,
    };

    // Close form immediately so the board is visible while we save.
    setOpenForm(false);

    try {
      const result = await adminApiJson<{
        success?: boolean;
        data?: Record<string, unknown>;
      }>("/api/admin/timetable", {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          classId: draft.classId,
          subjectId: draft.subjectId,
          teacherId: draft.teacherProfileId,
          dayOfWeek: draft.dayOfWeek,
          startTime: draft.startTime,
          endTime: draft.endTime,
        }),
      });

      const created = mapCreatedLesson(result?.data, draft);
      if (created) {
        setLessons((prev) => {
          if (prev.some((row) => row.id === created.id)) return prev;
          return [...prev, created];
        });
      }

      toast.success("Lesson saved", { id: toastId });

      // Background reconcile (do not block UI). Lessons-only is enough.
      void fetchAll({ lessonsOnly: true }).catch(() => {
        // optimistic row already painted
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save lesson",
        { id: toastId },
      );
      // Re-open form so the user can fix without re-entering everything.
      setOpenForm(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(id: string) {
    if (!canEdit || !schoolId) return;
    if (!confirm("Delete this lesson from the timetable?")) return;
    const toastId = toast.loading("Deleting lesson...");

    const previous = lessons;
    // Optimistic remove - board updates instantly.
    setLessons((prev) => prev.filter((row) => row.id !== id));
    setDetailLessonId(null);

    try {
      await adminApiJson(
        `/api/admin/timetable?id=${encodeURIComponent(id)}`,
        { method: "DELETE", cache: "no-store" },
      );
      toast.success("Lesson deleted", { id: toastId });
      void fetchAll({ lessonsOnly: true }).catch(() => {});
    } catch (err: unknown) {
      setLessons(previous);
      toast.error(
        err instanceof Error ? err.message : "Failed to delete lesson",
        { id: toastId },
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-10">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading timetable…</span>
      </div>
    );
  }

  // ── Teacher picker (compact list) ─────────────────────────────────────────
  if (viewMode === "teacher" && !selectedTeacher) {
    return (
      <div className="flex flex-col gap-3">
        <CompactHeader
          title="Teacher schedules"
          subtitle={`${teachers.length} teachers · ${lessons.length} lessons school-wide`}
          tabs={<ViewModeTabs active="teacher" />}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            placeholder="Search teacher…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-200"
          />
        </div>

        {filteredTeachers.length === 0 ? (
          <EmptyBoard
            title="No teachers found"
            body="Add teaching staff under People, then build their schedules here."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Teacher</th>
                  <th className="px-3 py-2 w-28 text-right">Lessons</th>
                  <th className="px-3 py-2 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => {
                  const count = teacherLessonCounts.get(teacher.id) || 0;
                  return (
                    <tr
                      key={teacher.id}
                      className="cursor-pointer hover:bg-slate-50/80"
                      onClick={() => setSelectedTeacher(teacher.id)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">
                        {teacher.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {count === 0 ? (
                          <span className="text-amber-600">None</span>
                        ) : (
                          count
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        <ChevronLeft className="inline h-4 w-4 rotate-180" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── Main compact week view ────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3">
      {schoolHours ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2.5 text-sm text-slate-700">
          <p className="font-semibold text-violet-900">School day hours</p>
          <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
            Classes run{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {schoolHours.classesStartAt.slice(0, 5)} –{" "}
              {schoolHours.classesEndAt.slice(0, 5)}
            </span>
            {schoolHours.schoolOpensAt ? (
              <>
                {" "}
                · campus open{" "}
                <span className="tabular-nums">
                  {schoolHours.schoolOpensAt.slice(0, 5)} –{" "}
                  {(schoolHours.schoolClosesAt || schoolHours.classesEndAt).slice(
                    0,
                    5,
                  )}
                </span>
              </>
            ) : null}
            . Set by the Head Teacher under School Profile.
          </p>
        </div>
      ) : null}
      <CompactHeader
        title={title}
        subtitle={
          totalInView === 0
            ? "No lessons in this view yet"
            : `${totalInView} lesson${totalInView === 1 ? "" : "s"} this week`
        }
        tabs={
          viewMode !== "self" ? (
            <ViewModeTabs
              active={viewMode === "class" ? "class" : "teacher"}
            />
          ) : null
        }
        actions={
          <>
            {viewMode === "teacher" ? (
              <button
                type="button"
                onClick={() => setSelectedTeacher("")}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                All teachers
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={openAddLesson}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Add lesson
              </button>
            ) : null}
          </>
        }
      />

      {/* Filters */}
      {viewMode === "class" ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[10rem] items-center gap-2">
            <span className="text-xs font-medium text-slate-500">Class</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="all">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {/* What's next - at a glance */}
      {nextUp.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              What&apos;s next
            </h2>
            <p className="text-[11px] text-slate-400">
              Today · {getDayFullLabel(todayKey)}
            </p>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {nextUp.map((lesson, i) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() => setDetailLessonId(lesson.id)}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition hover:border-slate-300 hover:bg-slate-50",
                  i === 0
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-slate-100 bg-slate-50/40",
                )}
              >
                <span className="mt-0.5 shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
                  {lesson.startsAt}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-900">
                    {lesson.subject}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {getDayFullLabel(lesson.dayOfWeek).slice(0, 3)}
                    {" · "}
                    {cardLens === "teacher"
                      ? lesson.teacher
                      : lesson.className}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Compact Mon–Fri glance grid (no empty hour rows) */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">Week at a glance</h2>
          <p className="text-[11px] text-slate-400">
            {totalInView} period{totalInView === 1 ? "" : "s"}
          </p>
        </div>

        {totalInView === 0 ? (
          <div className="p-4">
            <EmptyBoard
              title="Nothing scheduled in this view"
              body={
                canEdit
                  ? "Add a lesson - it appears under that day immediately."
                  : "No lessons match this filter."
              }
              action={
                canEdit ? (
                  <button
                    type="button"
                    onClick={openAddLesson}
                    className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add lesson
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop: 5 columns */}
            <div className="hidden md:grid md:grid-cols-5 md:divide-x md:divide-slate-100">
              {weekColumns.map((day) => (
                <DayColumn
                  key={day.key}
                  day={day}
                  isToday={day.key === todayKey}
                  lens={cardLens}
                  readOnly={readOnly}
                  onView={(id) => setDetailLessonId(id)}
                  onDelete={(id) => void deleteLesson(id)}
                />
              ))}
            </div>

            {/* Mobile: stacked days, only those with lessons first + empty compact */}
            <div className="divide-y divide-slate-100 md:hidden">
              {weekColumns.map((day) => (
                <DayColumn
                  key={day.key}
                  day={day}
                  isToday={day.key === todayKey}
                  lens={cardLens}
                  readOnly={readOnly}
                  onView={(id) => setDetailLessonId(id)}
                  onDelete={(id) => void deleteLesson(id)}
                  stacked
                />
              ))}
            </div>
          </>
        )}
      </section>

      {openForm ? (
        <Modal
          title="Add lesson"
          subtitle="Class, subject, teacher, day, and time."
          onClose={() => setOpenForm(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              label="Class"
              value={form.class_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, class_id: value }))
              }
              options={classes.map((x) => ({ value: x.id, label: x.name }))}
            />
            <SelectField
              label="Subject"
              value={form.subject_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, subject_id: value }))
              }
              options={subjects.map((x) => ({ value: x.id, label: x.name }))}
            />
            <SelectField
              label="Teacher"
              value={form.teacher_id}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, teacher_id: value }))
              }
              options={teachers.map((x) => ({ value: x.id, label: x.name }))}
              disabled={viewMode === "teacher" && Boolean(selectedTeacher)}
            />
            <SelectField
              label="Day"
              value={form.day_of_week}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, day_of_week: value }))
              }
              options={DAY_OPTIONS}
            />
            <TimeField
              label="Start"
              value={form.start_time}
              choices={timeChoices}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, start_time: value }))
              }
            />
            <TimeField
              label="End"
              value={form.end_time}
              choices={timeChoices}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, end_time: value }))
              }
            />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createLesson()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save
            </button>
          </div>
        </Modal>
      ) : null}

      {detailLesson && detailCard ? (
        <Modal
          title={detailCard.subject || detailCard.title}
          subtitle={`${getDayFullLabel(detailCard.dayOfWeek)} · ${detailCard.timeRange}`}
          onClose={() => setDetailLessonId(null)}
        >
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Teacher" value={detailCard.teacher} />
            <Metric label="Class" value={detailCard.className} />
            <Metric label="Starts" value={detailCard.startsAt} />
            <Metric label="Ends" value={detailCard.endsAt} />
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailLessonId(null)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Close
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void deleteLesson(detailLesson.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ─── Compact pieces ─────────────────────────────────────────────────────────

function CompactHeader({
  title,
  subtitle,
  tabs,
  actions,
}: {
  title: string;
  subtitle: string;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {title}
          </h1>
          {tabs}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function DayColumn({
  day,
  isToday,
  lens,
  readOnly,
  onView,
  onDelete,
  stacked = false,
}: {
  day: {
    key: number;
    label: string;
    fullLabel: string;
    lessons: LessonCardView[];
  };
  isToday: boolean;
  lens: "class" | "teacher";
  readOnly: boolean;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-h-0",
        isToday && "bg-emerald-50/40",
        stacked && "px-3 py-2",
      )}
    >
      <div
        className={cn(
          "sticky top-0 z-[1] flex items-center justify-between gap-1 border-b border-slate-100 bg-inherit px-2 py-1.5",
          stacked && "static border-0 px-0 pb-1.5 pt-0",
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-bold",
              isToday ? "text-emerald-800" : "text-slate-800",
            )}
          >
            {stacked ? day.fullLabel : day.label}
          </span>
          {isToday ? (
            <span className="rounded bg-emerald-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-emerald-700">
              Today
            </span>
          ) : null}
        </div>
        <span className="text-[10px] tabular-nums text-slate-400">
          {day.lessons.length || "-"}
        </span>
      </div>

      <div className={cn("space-y-1 p-1.5", stacked && "px-0 pb-1 pt-0")}>
        {day.lessons.length === 0 ? (
          <p className="px-1 py-3 text-center text-[10px] text-slate-300">
            Free
          </p>
        ) : (
          day.lessons.map((lesson) => (
            <LessonChip
              key={lesson.id}
              lesson={lesson}
              lens={lens}
              readOnly={readOnly}
              onView={() => onView(lesson.id)}
              onDelete={() => onDelete(lesson.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function LessonChip({
  lesson,
  lens,
  readOnly,
  onView,
  onDelete,
}: {
  lesson: LessonCardView;
  lens: "class" | "teacher";
  readOnly: boolean;
  onView: () => void;
  onDelete: () => void;
}) {
  const context = lens === "teacher" ? lesson.className : lesson.teacher;

  return (
    <div
      className={cn(
        "group rounded-md border border-slate-200/90 bg-white px-1.5 py-1 shadow-sm",
        "hover:border-slate-300",
      )}
    >
      <button type="button" onClick={onView} className="w-full text-left">
        <div className="flex items-baseline justify-between gap-1">
          <span className="truncate text-[11px] font-semibold leading-tight text-slate-900">
            {lesson.subject || lesson.title}
          </span>
          <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-500">
            {lesson.startsAt}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[10px] leading-tight text-slate-500">
          {context}
          <span className="text-slate-300"> · </span>
          {lesson.endsAt}
        </p>
      </button>
      {!readOnly ? (
        <div className="mt-0.5 hidden justify-end gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-1 py-0.5 text-[10px] font-medium text-rose-600 hover:bg-rose-50"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ViewModeTabs({ active }: { active: "class" | "teacher" }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
      <Link
        href="/app/admin/timetable/classes"
        className={cn(
          "rounded-md px-2 py-1 text-[11px] font-semibold transition",
          active === "class"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-800",
        )}
      >
        By class
      </Link>
      <Link
        href="/app/admin/timetable/teachers"
        className={cn(
          "rounded-md px-2 py-1 text-[11px] font-semibold transition",
          active === "teacher"
            ? "bg-white text-slate-900 shadow-sm"
            : "text-slate-500 hover:text-slate-800",
        )}
      >
        By teacher
      </Link>
    </div>
  );
}

function EmptyBoard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
      <CalendarDays className="mb-2 h-5 w-5 text-slate-300" />
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
        {body}
      </p>
      {action}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/40 p-3 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-lg items-start justify-center py-6 sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          className="w-full max-h-[min(90vh,720px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TimeField({
  label,
  value,
  onChange,
  choices = FALLBACK_TIME_CHOICES,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  choices?: string[];
}) {
  const listId = useId();
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <input
        type="text"
        list={listId}
        value={value}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm tabular-nums outline-none focus:ring-2 focus:ring-slate-200"
      />
      <datalist id={listId}>
        {choices.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </label>
  );
}

function addClock(value: string, addMinutes: number): string | null {
  const mins = toMinutes(value);
  if (!Number.isFinite(mins)) return null;
  const next = mins + addMinutes;
  if (next < 0 || next >= 24 * 60) return null;
  const h = Math.floor(next / 60);
  const m = next % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function subtractClock(value: string, subMinutes: number): string | null {
  return addClock(value, -subMinutes);
}

function toClassOptions(data: unknown): SelectOpt[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      const r = row as Record<string, unknown>;
      const id = String(r.id || "").trim();
      const name = String(r.name || r.label || "").trim();
      return id && name ? { id, name } : null;
    })
    .filter(Boolean) as SelectOpt[];
}

function normalizeTimeValue(value: string) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value || "").trim();
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function buildTimeChoices(start: string, end: string, stepMinutes: number) {
  const out: string[] = [];
  let cur = toMinutes(start);
  const endMin = toMinutes(end);
  while (cur <= endMin) {
    const h = Math.floor(cur / 60)
      .toString()
      .padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    out.push(`${h}:${m}`);
    cur += stepMinutes;
  }
  return out;
}
