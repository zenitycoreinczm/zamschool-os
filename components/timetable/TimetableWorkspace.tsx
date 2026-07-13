"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  Eye,
  Loader2,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { adminApiJson } from "@/lib/admin-browser-api";
import { fetchGatewayRead } from "@/lib/gateway-read-client";
import { getDisplayName } from "@/lib/profile-utils";
import { schoolLinkUserMessage } from "@/lib/school-access-error";
import { cn } from "@/lib/utils";

import {
  buildMobileDaySections,
  buildTimetableBoard,
  toMinutes,
  type LessonCardView,
  type TimetableLesson,
} from "@/lib/timetable-workspace";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

export type TimetableViewMode = "class" | "teacher" | "self";

type SelectOpt = { id: string; name: string };
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

const TIME_CHOICES = buildTimeChoices("06:00", "20:00", 5);

const EMPTY_FORM: LessonForm = {
  class_id: "",
  subject_id: "",
  teacher_id: "",
  day_of_week: "1",
  start_time: "07:00",
  end_time: "08:00",
};

const VIEW_COPY: Record<
  TimetableViewMode,
  { eyebrow: string; title: string; description: string }
> = {
  class: {
    eyebrow: "Class timetable",
    title: "Weekly class schedule",
    description:
      "Plan lessons by class, inspect the full week, and manage period assignments.",
  },
  teacher: {
    eyebrow: "Teacher timetable",
    title: "Weekly teacher schedule",
    description:
      "Select a teacher, then assign the classes they teach and when each lesson runs.",
  },
  self: {
    eyebrow: "My timetable",
    title: "Your teaching schedule",
    description:
      "See every class you teach this week, with subjects and times in one place.",
  },
};

export function TimetableWorkspace({ viewMode }: { viewMode: TimetableViewMode }) {
  const {
    data: wsData,
    loading: workspaceLoading,
  } = useWorkspaceContext();
  const currentUserId = wsData?.userId || null;
  const workspaceSchoolId = String(wsData?.schoolId || "").trim() || null;
  const readOnly = viewMode === "self";
  const canEdit = !readOnly;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [classes, setClasses] = useState<SelectOpt[]>([]);
  const [subjects, setSubjects] = useState<SelectOpt[]>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);
  const [lessons, setLessons] = useState<TimetableLesson[]>([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [form, setForm] = useState<LessonForm>(EMPTY_FORM);
  const [openForm, setOpenForm] = useState(false);
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);

  const subjectMap = useMemo(
    () => Object.fromEntries(subjects.map((x) => [x.id, x.name])),
    [subjects],
  );
  const classMap = useMemo(
    () => Object.fromEntries(classes.map((x) => [x.id, x.name])),
    [classes],
  );
  const teacherMap = useMemo(
    () => Object.fromEntries(teachers.map((x) => [x.id, x.name])),
    [teachers],
  );

  const activeTeacherId =
    viewMode === "self"
      ? currentUserId || "all"
      : viewMode === "teacher" && selectedTeacher
        ? selectedTeacher
        : "all";

  const board = useMemo(
    () =>
      buildTimetableBoard({
        lessons,
        selectedClass: viewMode === "class" ? selectedClass : "all",
        selectedTeacher: activeTeacherId,
        classMap,
        subjectMap,
        teacherMap,
      }),
    [
      lessons,
      viewMode,
      selectedClass,
      activeTeacherId,
      classMap,
      subjectMap,
      teacherMap,
    ],
  );

  const mobileSections = useMemo(
    () =>
      buildMobileDaySections({
        lessons,
        selectedClass: viewMode === "class" ? selectedClass : "all",
        selectedTeacher: activeTeacherId,
        classMap,
        subjectMap,
        teacherMap,
      }),
    [
      lessons,
      viewMode,
      selectedClass,
      activeTeacherId,
      classMap,
      subjectMap,
      teacherMap,
    ],
  );

  const teacherLessonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lesson of lessons) {
      counts.set(lesson.teacher_id, (counts.get(lesson.teacher_id) || 0) + 1);
    }
    return counts;
  }, [lessons]);

  const cardsById = useMemo(() => {
    const map = new Map<string, LessonCardView>();
    for (const day of board.days) {
      for (const slot of day.slots) {
        for (const lesson of slot.lessons) {
          if (!map.has(lesson.id)) map.set(lesson.id, lesson);
        }
      }
    }
    return map;
  }, [board.days]);

  const detailLesson = detailLessonId
    ? (lessons.find((x) => x.id === detailLessonId) ?? null)
    : null;
  const detailCard = detailLessonId
    ? (cardsById.get(detailLessonId) ?? null)
    : null;

  const lensLabel =
    viewMode === "class"
      ? selectedClass === "all"
        ? "All classes"
        : classMap[selectedClass] || "Selected class"
      : viewMode === "teacher"
        ? teacherMap[selectedTeacher] || "Selected teacher"
        : "Your lessons";

  const copy = VIEW_COPY[viewMode];
  const cardLens = viewMode === "class" ? "teacher" : "class";

  useEffect(() => {
    // Wait for shell context so we don't hard-fail on a transient null schoolId.
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
          sid = String(schoolBody.data?.profile?.school_id || "").trim() || null;
        }
        if (!sid) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const retryBody = await adminApiJson<{
            data?: { profile?: { school_id?: string | null } };
          }>("/api/admin/school");
          sid = String(retryBody.data?.profile?.school_id || "").trim() || null;
        }
        if (!sid) throw new Error(schoolLinkUserMessage());
        if (cancelled) return;
        setSchoolId(sid);
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

  async function fetchAll() {
    const [classesRes, subjectRes, teacherRes, lessonsRes] = await Promise.all([
      fetchGatewayRead("/api/admin/classes", {
        cache: "no-store",
        fallbackToLocal: true,
      }),
      adminApiJson<{ data?: SelectOpt[] }>("/api/admin/subjects"),
      adminApiJson<{ data?: { teachers?: unknown[] } }>("/api/admin/users"),
      fetchGatewayRead("/api/admin/timetable", {
        cache: "no-store",
        fallbackToLocal: true,
      }),
    ]);
    const classesBody = await classesRes.json();
    const lessonsBody = await lessonsRes.json();
    if (!classesRes.ok) {
      throw new Error(classesBody?.error || "Failed to load classes");
    }
    if (!lessonsRes.ok) {
      throw new Error(lessonsBody?.error || "Failed to load timetable");
    }
    const nextClasses = toClassOptions(classesBody?.data);
    const nextSubjects = (subjectRes.data || []).map((x) => ({
      id: x.id,
      name: x.name,
    }));
    const nextTeachers = (teacherRes.data?.teachers || []).map((x: unknown) => {
      const row = x as Record<string, unknown>;
      return { id: String(row.id || ""), name: getDisplayName(row) };
    });
    setClasses(nextClasses);
    setSubjects(nextSubjects);
    setTeachers(nextTeachers);
    setLessons((lessonsBody?.data || []) as TimetableLesson[]);
    setForm((prev) => ({
      ...prev,
      class_id: prev.class_id || nextClasses[0]?.id || "",
      subject_id: prev.subject_id || nextSubjects[0]?.id || "",
      teacher_id: prev.teacher_id || nextTeachers[0]?.id || "",
    }));
  }

  function openAddLesson() {
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
    }));
    setOpenForm(true);
  }

  async function createLesson() {
    if (!schoolId) return;
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
    setSaving(true);
    const id = toast.loading("Saving lesson...");
    try {
      await adminApiJson("/api/admin/timetable", {
        method: "POST",
        body: JSON.stringify({
          // Title is derived from the subject on display — no manual label needed.
          classId: form.class_id,
          subjectId: form.subject_id,
          teacherId: form.teacher_id,
          dayOfWeek: Number(form.day_of_week),
          startTime,
          endTime,
        }),
      });
      await fetchAll();
      setOpenForm(false);
      toast.success("Lesson saved", { id });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save lesson",
        { id },
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLesson(id: string) {
    if (!schoolId) return;
    if (!confirm("Delete this lesson from the timetable?")) return;
    const toastId = toast.loading("Deleting lesson...");
    try {
      await adminApiJson(
        `/api/admin/timetable?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      await fetchAll();
      setDetailLessonId(null);
      toast.success("Lesson deleted", { id: toastId });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete lesson",
        { id: toastId },
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-workspace-xl border border-slate-200 bg-white p-12">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading timetable…</span>
      </div>
    );
  }

  if (viewMode === "teacher" && !selectedTeacher) {
    return (
      <div className="flex flex-col gap-4">
        <AdminPageHero
          eyebrow={copy.eyebrow}
          title="Choose a teacher"
          description="Open a teacher’s weekly board to view or schedule their lessons. Teachers see the same plan on their own timetable."
          accent="slate"
          stats={[
            {
              label: "Teachers",
              value: teachers.length,
              hint: "On staff directory",
              tone: "violet",
            },
            {
              label: "Lessons total",
              value: lessons.length,
              hint: "School-wide",
              tone: "sky",
            },
            {
              label: "With schedule",
              value: teachers.filter((t) => (teacherLessonCounts.get(t.id) || 0) > 0)
                .length,
              hint: "At least one lesson",
              tone: "emerald",
            },
            {
              label: "No lessons yet",
              value: teachers.filter((t) => !(teacherLessonCounts.get(t.id) || 0))
                .length,
              hint: "Need a first period",
              tone: "amber",
            },
          ]}
          actions={<ViewModeTabs active="teacher" onDark />}
        />

        {teachers.length === 0 ? (
          <EmptyBoard
            title="No teachers yet"
            body="Add teaching staff under Users, then come back to build their schedules."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {teachers.map((teacher) => {
              const count = teacherLessonCounts.get(teacher.id) || 0;
              return (
                <button
                  key={teacher.id}
                  type="button"
                  onClick={() => setSelectedTeacher(teacher.id)}
                  className="group flex items-start gap-3 rounded-workspace-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
                    <User className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {teacher.name}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {count === 0
                        ? "No lessons yet"
                        : `${count} lesson${count === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  <ChevronLeft className="h-4 w-4 shrink-0 rotate-180 text-slate-300 transition group-hover:text-indigo-500" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const heroAccent =
    viewMode === "teacher" ? "indigo" : viewMode === "self" ? "emerald" : "sky";

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHero
        eyebrow={copy.eyebrow}
        title={
          viewMode === "teacher"
            ? teacherMap[selectedTeacher] || copy.title
            : copy.title
        }
        description={copy.description}
        accent={heroAccent}
        stats={[
          {
            label: "Lessons",
            value: board.totalLessons,
            hint: "In this view",
            tone: "sky",
          },
          {
            label: "Busiest day",
            value: board.busiestDayLabel,
            hint: "Most periods",
            tone: "violet",
          },
          {
            label: viewMode === "class" ? "Class" : "Focus",
            value: lensLabel,
            hint: viewMode === "self" ? "Your schedule" : "Current filter",
            tone: "amber",
          },
          {
            label: "Subjects",
            value: subjects.length,
            hint: "In school catalog",
            tone: "emerald",
          },
        ]}
        actions={
          <>
            {viewMode === "teacher" ? (
              <button
                type="button"
                onClick={() => setSelectedTeacher("")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
              >
                <ChevronLeft className="h-4 w-4" />
                All teachers
              </button>
            ) : null}
            {canEdit ? (
              <button
                type="button"
                onClick={openAddLesson}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                Add lesson
              </button>
            ) : null}
          </>
        }
      />

      {/* Toolbar: mode + filter in one calm row */}
      <div className="flex flex-col gap-3 rounded-workspace-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4">
        {viewMode !== "self" ? (
          <ViewModeTabs active={viewMode === "class" ? "class" : "teacher"} />
        ) : (
          <p className="text-sm font-medium text-slate-600">Your teaching week</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {viewMode === "class" ? (
            <label className="flex min-w-[12rem] flex-1 items-center gap-2 sm:flex-none">
              <span className="sr-only">Filter by class</span>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-sky-100 sm:min-w-[14rem]"
              >
                <option value="all">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={openAddLesson}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800 sm:hidden"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobile day list */}
      <section className="space-y-3 lg:hidden">
        {mobileSections.length === 0 ? (
          <EmptyBoard
            title="No lessons in this view"
            body={
              canEdit
                ? "Add a lesson to place the first period on the week."
                : "Nothing is scheduled for you in this range yet."
            }
            action={
              canEdit ? (
                <button
                  type="button"
                  onClick={openAddLesson}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  Add lesson
                </button>
              ) : null
            }
          />
        ) : (
          mobileSections.map((section) => (
            <div
              key={section.key}
              className="rounded-workspace-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {section.label}
                </h2>
                <p className="text-xs font-medium text-slate-400">
                  {section.lessons.length}{" "}
                  {section.lessons.length === 1 ? "lesson" : "lessons"}
                </p>
              </div>
              <div className="space-y-2">
                {section.lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    compact
                    lens={cardLens}
                    onView={() => setDetailLessonId(lesson.id)}
                    onDelete={() => void deleteLesson(lesson.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {/* Desktop weekly board */}
      <section className="hidden overflow-hidden rounded-workspace-xl border border-slate-200 bg-white shadow-sm lg:block">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Weekly board
            </h2>
            <p className="text-xs text-slate-500">
              {board.totalLessons === 0
                ? "Empty week — add a lesson to start the grid."
                : `Showing ${board.totalLessons} lesson${board.totalLessons === 1 ? "" : "s"} · slots follow lesson times`}
            </p>
          </div>
          {canEdit && board.totalLessons > 0 ? (
            <button
              type="button"
              onClick={openAddLesson}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Add lesson
            </button>
          ) : null}
        </div>

        {board.totalLessons === 0 ? (
          <div className="p-6">
            <EmptyBoard
              title="Nothing scheduled yet"
              body={
                canEdit
                  ? "Create the first lesson for this view. The board grows around real periods instead of empty hours."
                  : "No lessons match this view."
              }
              action={
                canEdit ? (
                  <button
                    type="button"
                    onClick={openAddLesson}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add lesson
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[960px]"
              style={{
                gridTemplateColumns: "88px repeat(5, minmax(0, 1fr))",
              }}
            >
              <div className="sticky left-0 z-10 border-b border-r border-slate-100 bg-slate-50/95 px-2 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 backdrop-blur">
                Time
              </div>
              {board.days.map((day) => (
                <div
                  key={day.key}
                  className="border-b border-r border-slate-100 bg-slate-50/80 px-3 py-3 last:border-r-0"
                >
                  <div className="text-sm font-semibold text-slate-800">
                    {day.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {day.totalLessons === 0
                      ? "Free"
                      : `${day.totalLessons} lesson${day.totalLessons === 1 ? "" : "s"}`}
                  </div>
                </div>
              ))}
              {board.days[0]?.slots.map((slot, index) => (
                <ScheduleRow
                  key={slot.label}
                  slotLabel={slot.label}
                  slotIndex={index}
                  days={board.days}
                  lens={cardLens}
                  onView={(id) => setDetailLessonId(id)}
                  onDelete={(id) => void deleteLesson(id)}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {openForm ? (
        <Modal
          title="Add lesson"
          subtitle="Pick class, subject, teacher, day, and time. The board uses the subject name automatically."
          onClose={() => setOpenForm(false)}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
              label="Start time"
              value={form.start_time}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, start_time: value }))
              }
            />
            <TimeField
              label="End time"
              value={form.end_time}
              onChange={(value) =>
                setForm((prev) => ({ ...prev, end_time: value }))
              }
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpenForm(false)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void createLesson()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save lesson
            </button>
          </div>
        </Modal>
      ) : null}

      {detailLesson && detailCard ? (
        <Modal
          title={detailCard.title}
          subtitle={`${DAY_OPTIONS.find((day) => Number(day.value) === detailLesson.day_of_week)?.label || "Day"} · ${detailCard.timeRange}`}
          onClose={() => setDetailLessonId(null)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Subject" value={detailCard.subject} />
            <Metric label="Teacher" value={detailCard.teacher} />
            <Metric label="Class" value={detailCard.className} />
            <Metric
              label="Duration"
              value={`${detailCard.durationMinutes} minutes`}
            />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDetailLessonId(null)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Close
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void deleteLesson(detailLesson.id)}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white"
              >
                <Trash2 className="h-4 w-4" /> Delete lesson
              </button>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function ViewModeTabs({
  active,
  onDark = false,
}: {
  active: "class" | "teacher";
  /** Lighter control for use on AdminPageHero. */
  onDark?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-xl p-0.5",
        onDark
          ? "border border-white/20 bg-white/10"
          : "border border-slate-200 bg-slate-50",
      )}
    >
      <Link
        href="/app/admin/timetable/classes"
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          active === "class"
            ? onDark
              ? "bg-white text-slate-900 shadow-sm"
              : "bg-white text-sky-900 shadow-sm ring-1 ring-slate-200/80"
            : onDark
              ? "text-white/75 hover:text-white"
              : "text-slate-500 hover:text-slate-800",
        )}
      >
        By class
      </Link>
      <Link
        href="/app/admin/timetable/teachers"
        className={cn(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          active === "teacher"
            ? onDark
              ? "bg-white text-slate-900 shadow-sm"
              : "bg-white text-indigo-900 shadow-sm ring-1 ring-slate-200/80"
            : onDark
              ? "text-white/75 hover:text-white"
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
    <div className="flex flex-col items-center justify-center rounded-workspace-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
        <CalendarDays className="h-5 w-5" />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">
        {body}
      </p>
      {action}
    </div>
  );
}

function ScheduleRow({
  slotLabel,
  slotIndex,
  days,
  lens,
  onView,
  onDelete,
  readOnly = false,
}: {
  slotLabel: string;
  slotIndex: number;
  days: ReturnType<typeof buildTimetableBoard>["days"];
  lens: "class" | "teacher";
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const rowHasLessons = days.some(
    (day) => (day.slots[slotIndex]?.lessons.length || 0) > 0,
  );

  return (
    <>
      <div
        className={cn(
          "sticky left-0 z-10 border-b border-r border-slate-100 px-2 py-2 text-center text-[11px] font-medium tabular-nums text-slate-500 backdrop-blur",
          rowHasLessons ? "bg-white" : "bg-slate-50/40",
        )}
      >
        {slotLabel}
      </div>
      {days.map((day) => {
        const slot = day.slots[slotIndex];
        const lessons = slot?.lessons || [];
        return (
          <div
            key={`${day.key}-${slotLabel}`}
            className={cn(
              "min-h-[3.25rem] border-b border-r border-slate-100 p-1.5 last:border-r-0",
              lessons.length === 0 && "bg-slate-50/20",
            )}
          >
            {lessons.length === 0 ? null : (
              <div className="space-y-1.5">
                {lessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    lens={lens}
                    onView={() => onView(lesson.id)}
                    onDelete={() => onDelete(lesson.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function LessonCard({
  lesson,
  compact = false,
  lens,
  onView,
  onDelete,
  readOnly = false,
}: {
  lesson: LessonCardView;
  compact?: boolean;
  lens: "class" | "teacher";
  onView: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const tone = toneClasses(lesson.tone);
  // Subject first; class view shows teacher (+ class when useful), teacher view shows class.
  const contextLine =
    lens === "teacher"
      ? lesson.className
      : compact
        ? lesson.teacher
        : [lesson.teacher, lesson.className].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "group relative rounded-xl border px-2.5 py-2 shadow-sm transition hover:shadow-md",
        tone,
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onView}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-semibold leading-snug text-slate-900">
            {lesson.subject || lesson.title}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-600">
            {contextLine}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-slate-600">
            <Clock3 className="h-3 w-3 shrink-0 opacity-70" />
            {lesson.timeRange}
            {!compact ? (
              <span className="font-normal text-slate-400">
                · {lesson.durationMinutes}m
              </span>
            ) : null}
          </p>
        </button>
        {!readOnly ? (
          <div className="flex shrink-0 flex-col gap-0.5 opacity-80 group-hover:opacity-100">
            <button
              type="button"
              onClick={onView}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-slate-500 ring-1 ring-slate-200/80 hover:text-slate-800"
              aria-label="View lesson"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-rose-500 ring-1 ring-rose-100 hover:bg-rose-50"
              aria-label="Delete lesson"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
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
  // Pin to the viewport (not the long timetable board). Without a body portal,
  // fixed positioning can bind to the shell scroll area and the dialog lands
  // mid-page — users had to scroll twice to find "Add lesson".
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
      className="fixed inset-0 z-[200] overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-start justify-center py-4 sm:items-center sm:py-8">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="timetable-modal-title"
          className="w-full max-h-[min(92vh,880px)] overflow-y-auto rounded-[28px] border border-slate-200 bg-white p-5 shadow-2xl md:p-6"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Timetable
              </p>
              <h2
                id="timetable-modal-title"
                className="mt-2 text-xl font-semibold text-slate-900"
              >
                {title}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();

  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <input
        type="text"
        list={listId}
        value={value}
        inputMode="numeric"
        placeholder="07:00"
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onChange(normalizeTimeValue(e.target.value))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-sky-100"
      />
      <datalist id={listId}>
        {TIME_CHOICES.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toneClasses(tone: LessonCardView["tone"]) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50/80";
    case "amber":
      return "border-amber-200 bg-amber-50/80";
    case "violet":
      return "border-violet-200 bg-violet-50/80";
    case "rose":
      return "border-rose-200 bg-rose-50/80";
    default:
      return "border-sky-200 bg-sky-50/80";
  }
}

function toClassOptions(rows: unknown): SelectOpt[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row: unknown) => {
    const record = row as Record<string, unknown>;
    const id = typeof record?.id === "string" ? record.id : "";
    const className =
      typeof record?.name === "string" ? record.name.trim() : "";
    const grades = record?.grades as Record<string, unknown> | undefined;
    const gradeName =
      typeof grades?.name === "string" ? grades.name.trim() : "";
    const name =
      [gradeName, className].filter(Boolean).join(" - ") ||
      className ||
      gradeName;
    return id && name ? [{ id, name }] : [];
  });
}

function buildTimeChoices(start: string, end: string, stepMinutes: number) {
  const out: string[] = [];
  let cursor = toMinutes(start);
  const endMinutes = toMinutes(end);

  while (cursor <= endMinutes) {
    out.push(toClockValue(cursor));
    cursor += stepMinutes;
  }

  return out;
}

function normalizeTimeValue(value: string) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return String(value || "").trim();
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function toClockValue(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}