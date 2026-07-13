"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2, X, Edit } from "lucide-react";
import { toast } from "sonner";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import { Surface } from "@/components/workspace/Surface";
import { useSearchParams } from "next/navigation";
import { parseQueryState } from "@/lib/list-query-state";
import { useListQuery } from "@/lib/use-list-query";
import { adminDelete, adminGet, adminPost, adminRequest } from "@/lib/admin-route-client";
import { getDisplayName } from "@/lib/profile-utils";
import { formatDate } from "@/lib/utils";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";

const columns = [
  { header: "Title", accessor: "title" },
  { header: "Subject", accessor: "subject", className: "hidden md:table-cell" },
  { header: "Class", accessor: "class" },
  { header: "Teacher", accessor: "teacher", className: "hidden md:table-cell" },
  { header: "Due Date", accessor: "dueDate", className: "hidden md:table-cell" },
  { header: "Marks", accessor: "marks", className: "hidden lg:table-cell" },
  { header: "Actions", accessor: "action" },
];

type AssignmentForm = {
  id?: string;
  title: string;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  due_date: string;
  total_marks: string;
  description: string;
};

type AssignmentRow = Omit<AssignmentForm, "id"> & {
  id: string;
  subject: string;
  class: string;
  teacher: string;
  dueDate: string;
  marks: number;
};

const emptyForm: AssignmentForm = {
  title: "",
  subject_id: "",
  class_id: "",
  teacher_id: "",
  due_date: "",
  total_marks: "100",
  description: "",
};

export default function AdminAssignmentsPage() {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm>(emptyForm);
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const { page, pageSize, updateQuery } = useListQuery();

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const [assignmentsResponse, subjectsResponse, classesResponse, relationshipsResponse] = await Promise.all([
        adminGet("/api/admin/assignments"),
        adminGet("/api/admin/subjects"),
        adminGet("/api/admin/classes"),
        adminGet("/api/admin/relationships"),
      ]);

      const subjectsData = Array.isArray(subjectsResponse?.data) ? subjectsResponse.data : [];
      const classesData = Array.isArray(classesResponse?.data) ? classesResponse.data : [];
      const teachersData = normalizeTeacherOptions(relationshipsResponse?.data?.teachers);
      const subjectMap = Object.fromEntries(subjectsData.map((item: any) => [item.id, item.name]));
      const classMap = Object.fromEntries(classesData.map((item: any) => [item.id, item.name]));
      const teacherMap = buildTeacherMap(teachersData);

      const assignmentRows = Array.isArray(assignmentsResponse?.data) ? assignmentsResponse.data : [];
      setRows(assignmentRows.map((item: any) => mapAssignmentRow(item, subjectMap, classMap, teacherMap)));
      setSubjects(subjectsData);
      setClasses(classesData);
      setTeachers(teachersData);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load assignments");
      setRows([]);
      setSubjects([]);
      setClasses([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    const qs = parseQueryState(searchParams);
    setSearch(qs.q || "");
  }, [searchParams]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (item: AssignmentRow) => {
    setEditingId(item.id);
    setForm({
      id: item.id,
      title: item.title || "",
      subject_id: item.subject_id || "",
      class_id: item.class_id || "",
      teacher_id: item.teacher_id || "",
      due_date: item.due_date || "",
      total_marks: String(item.total_marks || 100),
      description: item.description || "",
    });
    setFormOpen(true);
  };

  const onSave = async () => {
    if (!form.title.trim() || !form.subject_id || !form.class_id || !form.teacher_id || !form.due_date) {
      toast.error("Title, subject, class, teacher, and due date are required");
      return;
    }

    setSaving(true);
    const payload = {
      title: form.title.trim(),
      subjectId: form.subject_id,
      classId: form.class_id,
      teacherId: form.teacher_id,
      dueDate: form.due_date,
      totalMarks: Number(form.total_marks || 100),
      description: form.description.trim() || null,
    };

    const loadingToast = toast.loading(editingId ? "Updating assignment..." : "Creating assignment...");
    try {
      if (editingId) {
        await adminRequest("/api/admin/assignments", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await adminPost("/api/admin/assignments", payload);
      }

      toast.success(editingId ? "Assignment updated" : "Assignment created", { id: loadingToast });
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      await loadAssignments();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save assignment", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Delete this assignment?")) return;

    const loadingToast = toast.loading("Deleting assignment...");
    try {
      await adminDelete("/api/admin/assignments", { params: { id } });
      toast.success("Assignment deleted", { id: loadingToast });
      await loadAssignments();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed", { id: loadingToast });
    }
  };

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((item) =>
      `${item.title || ""} ${item.subject || ""} ${item.class || ""} ${item.teacher || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [rows, search]);

  const visibleRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const metrics = useMemo(() => {
    const now = new Date();
    const dueSoonCutoff = new Date(now);
    dueSoonCutoff.setDate(now.getDate() + 7);

    return {
      total: rows.length,
      dueSoon: rows.filter((item) => {
        const dueDate = item.due_date ? new Date(item.due_date) : null;
        return dueDate && !Number.isNaN(dueDate.getTime()) && dueDate >= now && dueDate <= dueSoonCutoff;
      }).length,
      classes: new Set(rows.map((item) => item.class_id).filter(Boolean)).size,
    };
  }, [rows]);

  const renderRow = (item: AssignmentRow) => (
    <tr key={item.id} className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight">
      <td className="p-4 font-medium">{item.title}</td>
      <td className="hidden md:table-cell text-slate-600">{item.subject}</td>
      <td className="text-slate-600">{item.class}</td>
      <td className="hidden md:table-cell text-slate-600">{item.teacher}</td>
      <td className="hidden md:table-cell text-slate-600">{item.dueDate}</td>
      <td className="hidden lg:table-cell text-slate-600">{item.marks}</td>
      <td>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(item)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky hover:bg-sky-600 transition-colors"
            aria-label={`Edit ${item.title}`}
          >
            <Edit className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaPurple hover:bg-purple-600 transition-colors"
            aria-label={`Delete ${item.title}`}
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
      </td>
    </tr>
  );

  if (loading) {
    return (
      <Surface
        variant="default"
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500"
        as="div"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        <span>Loading assignments...</span>
      </Surface>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Assignments</h1>
          <p className="text-slate-500 mt-1">Manage homework and class assignments.</p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <Metric label="All assignments" value={String(metrics.total)} />
            <Metric label="Due in 7 days" value={String(metrics.dueSoon)} />
            <Metric label="Classes covered" value={String(metrics.classes)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <TableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              updateQuery({ q: value, page: 1 });
            }}
            placeholder="Search assignments"
          />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <Plus className="h-4 w-4" /> Add Assignment
          </button>
        </div>
      </div>

      {formOpen ? (
        <Surface variant="inset" className="p-5" as="div">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            {editingId ? "Edit Assignment" : "New Assignment"}
          </h3>
          <div className="grid md:grid-cols-3 gap-3">
            <input
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              placeholder="Assignment title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={form.subject_id}
              onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
            >
              <option value="">Select subject</option>
              {subjects.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={form.class_id}
              onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value }))}
            >
              <option value="">Select class</option>
              {classes.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              value={form.teacher_id}
              onChange={(e) => setForm((f) => ({ ...f, teacher_id: e.target.value }))}
            >
              <option value="">Select teacher</option>
              {teachers.map((item: any) => (
                <option key={item.id} value={item.id}>
                  {getDisplayName(item)}
                </option>
              ))}
            </select>
            <DateOnlyPicker
              value={form.due_date}
              onChange={(date) => setForm((f) => ({ ...f, due_date: date }))}
              label="Due date"
              accent="slate"
            />
            <input
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
              placeholder="Total marks"
              value={form.total_marks}
              onChange={(e) => setForm((f) => ({ ...f, total_marks: e.target.value }))}
            />
            <input
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm md:col-span-3"
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-60"
            >
              {saving ? "Saving..." : (
                <>
                  <Save className="h-4 w-4" /> Save
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
        </Surface>
      ) : null}

      <Surface variant="default" className="overflow-hidden p-0" as="div">
        <Table columns={columns} renderRow={renderRow} data={visibleRows} />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredRows.length}
          onPageChange={(nextPage) => updateQuery({ page: nextPage })}
        />
      </Surface>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function mapAssignmentRow(
  item: any,
  subjectMap: Record<string, string>,
  classMap: Record<string, string>,
  teacherMap: Record<string, string>
): AssignmentRow {
  const subjectRow = normalizeRelationRow(item.subjects ?? item.subject ?? item.subject_row);
  const classRow = normalizeRelationRow(item.classes ?? item.class ?? item.class_row);
  const teacherRow = normalizeRelationRow(item.teacher ?? item.profiles ?? item.profile ?? item.teacher_profile);

  const teacherLabel = getDisplayName(teacherRow);

  return {
    id: item.id,
    title: item.title || "",
    subject_id: item.subject_id || "",
    class_id: item.class_id || "",
    teacher_id: item.teacher_id || "",
    due_date: item.due_date || "",
    total_marks: String(item.total_marks ?? 100),
    description: item.description || "",
    subject: subjectRow?.name || subjectMap[item.subject_id] || "-",
    class: classRow?.name || classMap[item.class_id] || "-",
    teacher: teacherLabel !== "User" ? teacherLabel : teacherMap[item.teacher_id] || "-",
    dueDate: item.due_date ? formatDate(item.due_date) : "-",
    marks: Number(item.total_marks || 0),
  };
}

function normalizeRelationRow(value: any) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function normalizeTeacherOptions(value: any) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item: any) => ({
      id: item?.profileId || item?.teacherId || "",
      teacherId: item?.teacherId || null,
      name: item?.displayName || item?.email || "Teacher",
      email: item?.email || null,
    }))
    .filter((item) => item.id);
}

function buildTeacherMap(teachers: any[]) {
  const entries: Array<[string, string]> = [];

  for (const teacher of teachers) {
    const label = getDisplayName(teacher);
    if (teacher.id) {
      entries.push([teacher.id, label]);
    }
    if (teacher.teacherId) {
      entries.push([teacher.teacherId, label]);
    }
  }

  return Object.fromEntries(entries);
}
