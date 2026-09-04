"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
  TeacherStatCard,
} from "@/components/teacher/TeacherWorkspaceUI";
import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import { adminApiJson } from "@/lib/admin-browser-api";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";

type AssignmentRow = {
  id: string;
  title: string;
  description?: string | null;
  due_date: string;
  total_marks: number;
  class_id: string;
  subject_id: string;
  created_at?: string;
  classes?: { name?: string } | { name?: string }[] | null;
  subjects?: { name?: string } | { name?: string }[] | null;
  submittedCount?: number;
  totalStudents?: number;
  gradedCount?: number;
  pendingGrades?: number;
};

type NamedOption = { id: string; name: string };

function nestedName(
  value: { name?: string } | { name?: string }[] | null | undefined,
): string {
  if (!value) return "-";
  if (Array.isArray(value)) return value[0]?.name || "-";
  return value.name || "-";
}

function formatDue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() < Date.now();
}

function relativeDue(dueDate: string) {
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return dueDate;
  const now = new Date();
  // reset hours to midnight for day calculation
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((dDay - nowDay) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

export default function TeacherAssignmentsPage() {
  const { account } = useTeacherWorkspace();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "overdue">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const classOptions = useMemo<NamedOption[]>(() => {
    const map = new Map<string, string>();
    for (const item of account?.teacher?.assignedClasses || []) {
      if (item?.id) map.set(item.id, item.name || "Class");
    }
    for (const item of account?.teacher?.supervisedClasses || []) {
      if (item?.id) map.set(item.id, item.name || "Class");
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [account?.teacher?.assignedClasses, account?.teacher?.supervisedClasses]);

  const subjectOptions = useMemo<NamedOption[]>(() => {
    return (account?.teacher?.assignedSubjects || [])
      .filter((item): item is { id: string; name: string } => Boolean(item?.id))
      .map((item) => ({ id: item.id, name: item.name || "Subject" }));
  }, [account?.teacher?.assignedSubjects]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    class_id: "",
    subject_id: "",
    due_date: "",
    total_marks: "100",
  });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const statusQuery =
        filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const body = await adminApiJson<{ data?: AssignmentRow[] }>(
        `/api/teacher/assignments${statusQuery}`,
      );
      setAssignments(Array.isArray(body.data) ? body.data : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load assignments",
      );
      setAssignments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!form.class_id && classOptions[0]?.id) {
      setForm((prev) => ({ ...prev, class_id: classOptions[0].id }));
    }
  }, [classOptions, form.class_id]);

  useEffect(() => {
    if (!form.subject_id && subjectOptions[0]?.id) {
      setForm((prev) => ({ ...prev, subject_id: subjectOptions[0].id }));
    }
  }, [subjectOptions, form.subject_id]);

  const stats = useMemo(() => {
    const overdue = assignments.filter((row) => isOverdue(row.due_date)).length;
    const active = assignments.filter((row) => !isOverdue(row.due_date)).length;
    const pendingGrades = assignments.reduce(
      (sum, row) => sum + (row.pendingGrades || 0),
      0,
    );
    return {
      total: assignments.length,
      active,
      overdue,
      pendingGrades,
    };
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    let list = assignments;
    if (filter === "active") {
      list = list.filter((a) => !isOverdue(a.due_date));
    } else if (filter === "overdue") {
      list = list.filter((a) => isOverdue(a.due_date));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)) ||
          nestedName(a.classes).toLowerCase().includes(q) ||
          nestedName(a.subjects).toLowerCase().includes(q),
      );
    }
    return list;
  }, [assignments, filter, searchQuery]);

  async function createAssignment() {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!form.class_id || !form.subject_id) {
      toast.error("Choose a class and subject");
      return;
    }
    if (!form.due_date) {
      toast.error("Choose a due date");
      return;
    }

    setCreating(true);
    try {
      await adminApiJson("/api/teacher/assignments", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          class_id: form.class_id,
          subject_id: form.subject_id,
          due_date: form.due_date,
          total_marks: Number(form.total_marks) || 100,
        }),
      });
      toast.success("Assignment created");
      setForm((prev) => ({
        ...prev,
        title: "",
        description: "",
        due_date: "",
        total_marks: "100",
      }));
      setFormOpen(false);
      await load(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create assignment",
      );
    } finally {
      setCreating(false);
    }
  }

  async function deleteAssignment(id: string) {
    const confirmed = window.confirm(
      "Delete this assignment? Students will no longer see it.",
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      await adminApiJson(
        `/api/teacher/assignments?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      toast.success("Assignment deleted");
      setAssignments((rows) => rows.filter((row) => row.id !== id));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete assignment",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <TeacherPageHeader
        eyebrow="Teaching"
        title="Assignments"
        description="Set classwork and homework for your classes, track due dates, and monitor student completion."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className={secondaryButton()}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setFormOpen((open) => !open)}
              className={primaryButton()}
            >
              {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {formOpen ? "Close" : "New assignment"}
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TeacherStatCard
          label="Total assignments"
          value={stats.total}
          tone="slate"
          icon={FileText}
          hint="Created by you"
        />
        <TeacherStatCard
          label="Upcoming"
          value={stats.active}
          tone="emerald"
          icon={Calendar}
          hint="Within due date"
        />
        <TeacherStatCard
          label="Overdue"
          value={stats.overdue}
          tone="rose"
          icon={AlertTriangle}
          hint="Past deadline"
        />
        <TeacherStatCard
          label="Pending grades"
          value={stats.pendingGrades}
          tone="amber"
          icon={GraduationCap}
          hint="Submissions open"
        />
      </div>

      {/* Toolbar: Search + Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", `All (${assignments.length})`],
              ["active", `Upcoming (${stats.active})`],
              ["overdue", `Overdue (${stats.overdue})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition duration-150",
                filter === key
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assignments…"
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
      </div>

      {formOpen ? (
        <TeacherCard elevated className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              New assignment
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Visible to students in the selected class for the subject you teach.
            </p>
          </div>

          {classOptions.length === 0 || subjectOptions.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              You need at least one assigned class and subject before creating
              assignments. Ask academic admin or registrar if nothing appears
              here.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, title: e.target.value }))
                    }
                    placeholder="e.g. Algebra worksheet 3"
                    className={inputClass}
                  />
                </Field>
                <Field label="Total marks">
                  <input
                    type="number"
                    min={1}
                    value={form.total_marks}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        total_marks: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Class">
                  <select
                    value={form.class_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, class_id: e.target.value }))
                    }
                    className={inputClass}
                  >
                    {classOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Subject">
                  <select
                    value={form.subject_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        subject_id: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {subjectOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <DateOnlyPicker
                    label="Due date"
                    value={form.due_date}
                    onChange={(value) =>
                      setForm((prev) => ({ ...prev, due_date: value }))
                    }
                    accent="slate"
                    placeholder="When is it due?"
                  />
                </div>
                <div className="md:col-span-2">
                  <Field label="Instructions (optional)">
                    <textarea
                      value={form.description}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="What should students do?"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void createAssignment()}
                disabled={creating}
                className={primaryButton()}
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}
                Publish assignment
              </button>
            </>
          )}
        </TeacherCard>
      ) : null}

      {loading ? (
        <TeacherCard className="grid place-items-center py-16 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm text-workspace-muted">Loading assignments…</p>
        </TeacherCard>
      ) : filteredAssignments.length === 0 ? (
        <TeacherEmptyState
          icon={FileText}
          title={searchQuery ? "No matching assignments" : "No assignments yet"}
          description={
            searchQuery
              ? "Try adjusting your search query or filter."
              : "Create homework or classwork for your classes. Students will see due dates in their portal."
          }
          action={
            !searchQuery ? (
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className={primaryButton("text-xs")}
              >
                <Plus className="h-3.5 w-3.5" />
                Create first assignment
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3.5">
          {filteredAssignments.map((row) => {
            const overdue = isOverdue(row.due_date);
            const dueLabel = relativeDue(row.due_date);
            const submitted = row.submittedCount ?? 0;
            const total = row.totalStudents ?? 0;
            const pct =
              total > 0 ? Math.min(100, Math.round((submitted / total) * 100)) : 0;

            return (
              <div
                key={row.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-950 leading-snug">
                      {row.title}
                    </h3>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {nestedName(row.classes)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {nestedName(row.subjects)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        overdue
                          ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
                      )}
                    >
                      {dueLabel}
                    </span>
                  </div>

                  {row.description ? (
                    <p className="text-xs text-slate-600 line-clamp-2 max-w-2xl leading-relaxed">
                      {row.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                      {row.total_marks} total marks
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      Due {formatDue(row.due_date)}
                    </span>
                    {typeof row.pendingGrades === "number" && row.pendingGrades > 0 ? (
                      <span className="font-semibold text-amber-700">
                        · {row.pendingGrades} pending review
                      </span>
                    ) : null}
                  </div>

                  {/* Submission Progress Bar */}
                  <div className="max-w-md pt-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span>Submissions: {submitted}/{total}</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          pct === 100
                            ? "bg-emerald-500"
                            : pct > 50
                              ? "bg-sky-500"
                              : "bg-slate-400",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                  <Link
                    href={`/app/teacher/results`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    Record marks
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteAssignment(row.id)}
                    disabled={deletingId === row.id}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {deletingId === row.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-workspace-lg border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 focus:border-brand/40 focus:ring-2 focus:ring-brand/15";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
