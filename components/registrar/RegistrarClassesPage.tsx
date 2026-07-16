"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  type ClassRow,
  createClass,
  deleteClass,
  fetchClasses,
  fetchRelationships,
  postRelationship,
  updateClass,
} from "./registrar-api";

const PAGE_SIZE = 12;

function gradeLabel(row: ClassRow) {
  if (row.grades?.name) return row.grades.name;
  if (row.grade_level != null) return `Grade ${row.grade_level}`;
  return "-";
}

function supervisorLabel(row: ClassRow) {
  if (!row.profiles) return "Not assigned";
  const first = (row.profiles as any).first_name ?? "";
  const last = (row.profiles as any).last_name ?? "";
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || "Not assigned";
}

export default function RegistrarClassesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Create / edit class form
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classForm, setClassForm] = useState({ name: "", gradeLevel: "", capacity: "30" });
  const [savingClass, setSavingClass] = useState(false);
  const [deletingClassId, setDeletingClassId] = useState<string | null>(null);

  // Assign supervisor panel
  const [supervisorPanelClass, setSupervisorPanelClass] = useState<ClassRow | null>(null);
  const [teachers, setTeachers] = useState<Array<{ profileId: string; displayName: string; employeeId: string | null }>>([]);
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [assigningSupervisor, setAssigningSupervisor] = useState(false);

  // Assign students panel
  const [studentPanelClass, setStudentPanelClass] = useState<ClassRow | null>(null);
  const [allStudents, setAllStudents] = useState<Array<{ profileId: string; displayName: string; admissionNumber: string | null; classId: string | null }>>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [assigningStudent, setAssigningStudent] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim().toLowerCase()); setPage(1); }, 280);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [classData, relData] = await Promise.all([fetchClasses(), fetchRelationships()]);
      setRows(classData);
      setTeachers(relData.teachers);
      setAllStudents(relData.students);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const resetClassForm = () => {
    setEditingClassId(null);
    setClassForm({ name: "", gradeLevel: "", capacity: "30" });
    setClassFormOpen(false);
  };

  const openCreateClass = () => {
    setEditingClassId(null);
    setClassForm({ name: "", gradeLevel: "", capacity: "30" });
    setClassFormOpen(true);
  };

  const openEditClass = (row: ClassRow) => {
    setEditingClassId(row.id);
    setClassForm({
      name: row.name,
      gradeLevel: row.grade_level != null ? String(row.grade_level) : "",
      capacity: row.capacity != null ? String(row.capacity) : "30",
    });
    setClassFormOpen(true);
  };

  const submitClassForm = async () => {
    const name = classForm.name.trim();
    if (!name) {
      toast.error("Class name is required");
      return;
    }

    const payload: Record<string, unknown> = { name };
    if (classForm.gradeLevel.trim()) payload.gradeLevel = Number(classForm.gradeLevel);
    if (classForm.capacity.trim()) payload.capacity = Number(classForm.capacity);

    setSavingClass(true);
    const t = toast.loading(editingClassId ? "Updating class…" : "Creating class…");
    try {
      if (editingClassId) {
        await updateClass({ id: editingClassId, ...payload });
        toast.success("Class updated", { id: t });
      } else {
        await createClass(payload);
        toast.success("Class created", { id: t });
      }
      resetClassForm();
      await load(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save class", { id: t });
    } finally {
      setSavingClass(false);
    }
  };

  const removeClass = async (row: ClassRow) => {
    const enrolledCount = allStudents.filter((s) => s.classId === row.id).length;
    if (enrolledCount > 0) {
      toast.error(`Move the ${enrolledCount} enrolled student${enrolledCount === 1 ? "" : "s"} out of "${row.name}" before deleting it.`);
      return;
    }
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return;

    setDeletingClassId(row.id);
    const t = toast.loading("Deleting class…");
    try {
      await deleteClass(row.id);
      toast.success("Class deleted", { id: t });
      if (editingClassId === row.id) resetClassForm();
      await load(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete class", { id: t });
    } finally {
      setDeletingClassId(null);
    }
  };

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((row) =>
      [row.name, gradeLabel(row), supervisorLabel(row), String(row.capacity ?? "")]
        .join(" ").toLowerCase().includes(debouncedSearch),
    );
  }, [rows, debouncedSearch]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const openSupervisorPanel = (row: ClassRow) => {
    setSupervisorPanelClass(row);
    setSupervisorSearch("");
  };

  const assignSupervisor = async (teacherProfileId: string | null) => {
    if (!supervisorPanelClass) return;
    setAssigningSupervisor(true);
    const t = toast.loading(teacherProfileId ? "Assigning class teacher…" : "Removing class teacher…");
    try {
      await postRelationship({
        action: "assign_class_supervisor",
        classId: supervisorPanelClass.id,
        supervisorId: teacherProfileId,
      });
      toast.success(teacherProfileId ? "Class teacher assigned" : "Class teacher removed", { id: t });
      setSupervisorPanelClass(null);
      await load(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to assign class teacher", { id: t });
    } finally {
      setAssigningSupervisor(false);
    }
  };

  const openStudentPanel = (row: ClassRow) => {
    setStudentPanelClass(row);
    setStudentSearch("");
  };

  const assignStudentToClass = async (studentProfileId: string, targetClassId: string | null) => {
    if (!studentPanelClass) return;
    setAssigningStudent(true);
    const t = toast.loading("Updating student class…");
    try {
      await postRelationship({
        action: "assign_student_class",
        studentProfileId,
        classId: targetClassId,
      });
      setAllStudents((prev) =>
        prev.map((s) => s.profileId === studentProfileId ? { ...s, classId: targetClassId } : s),
      );
      toast.success("Student class updated", { id: t });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update student class", { id: t });
    } finally {
      setAssigningStudent(false);
    }
  };

  const filteredSupervisors = useMemo(() => {
    const q = supervisorSearch.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) =>
      `${t.displayName} ${t.employeeId ?? ""}`.toLowerCase().includes(q),
    );
  }, [teachers, supervisorSearch]);

  const filteredStudentsForPanel = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return allStudents.filter((s) =>
      !q || `${s.displayName} ${s.admissionNumber ?? ""}`.toLowerCase().includes(q),
    );
  }, [allStudents, studentSearch]);

  const studentsInCurrentClass = useMemo(
    () => allStudents.filter((s) => s.classId === studentPanelClass?.id),
    [allStudents, studentPanelClass],
  );

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading classes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Registrar workspace</p>
        <h1 className="mt-2 text-2xl font-semibold">Classes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create classes, enrol students, and assign class teachers.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total classes", value: rows.length },
          { label: "With class teacher", value: rows.filter((r) => r.supervisor_id).length },
          { label: "Showing", value: filtered.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create / edit class */}
      {classFormOpen ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {editingClassId ? "Edit class" : "New class"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {editingClassId ? "Update the class details below." : "Add a class before enrolling students or assigning a class teacher."}
              </p>
            </div>
            <button
              type="button" onClick={resetClassForm}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="md:col-span-2">
              <span className="text-xs font-semibold text-slate-600">Class name</span>
              <input
                value={classForm.name}
                onChange={(e) => setClassForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Grade 8A"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                autoFocus
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-slate-600">Grade level</span>
              <input
                type="number" min={1} max={13}
                value={classForm.gradeLevel}
                onChange={(e) => setClassForm((prev) => ({ ...prev, gradeLevel: e.target.value }))}
                placeholder="8"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-slate-600">Capacity</span>
              <input
                type="number" min={1} max={200}
                value={classForm.capacity}
                onChange={(e) => setClassForm((prev) => ({ ...prev, capacity: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button" disabled={savingClass} onClick={() => void submitClassForm()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-55"
            >
              {savingClass ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingClassId ? "Save changes" : "Create class"}
            </button>
            <button
              type="button" onClick={resetClassForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* Class list */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">All classes</h2>
            <p className="mt-0.5 text-xs text-slate-500 tabular-nums">{filtered.length} class{filtered.length === 1 ? "" : "es"}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search classes…"
                className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <button
              type="button" onClick={() => (classFormOpen ? resetClassForm() : openCreateClass())}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {classFormOpen ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {classFormOpen ? "Close" : "Add class"}
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-800">{debouncedSearch ? "No classes match" : "No classes yet"}</p>
            <p className="mt-1 text-sm text-slate-500">
              {debouncedSearch ? "Try another name or grade." : "Create your first class, then enrol students and assign a class teacher."}
            </p>
            {!debouncedSearch ? (
              <button
                type="button" onClick={openCreateClass}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add class
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {pageRows.map((row) => {
                const enrolled = allStudents.filter((s) => s.classId === row.id).length;
                return (
                  <li key={row.id} className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{row.name}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span><span className="font-medium text-slate-600">Grade:</span> {gradeLabel(row)}</span>
                        <span className="tabular-nums"><span className="font-medium text-slate-600">Capacity:</span> {row.capacity ?? "-"}</span>
                        <span><span className="font-medium text-slate-600">Class teacher:</span> {supervisorLabel(row)}</span>
                        <span className="tabular-nums"><span className="font-medium text-slate-600">Students:</span> {enrolled}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pl-4">
                      <button
                        type="button" onClick={() => openStudentPanel(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Students ({enrolled})
                      </button>
                      <button
                        type="button" onClick={() => openSupervisorPanel(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Class teacher
                      </button>
                      <button
                        type="button" onClick={() => openEditClass(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button" onClick={() => void removeClass(row)} disabled={deletingClassId === row.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {deletingClassId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {filtered.length > PAGE_SIZE ? (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
                <p className="text-xs text-slate-500">Page {page} / {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* Assign class teacher modal */}
      {supervisorPanelClass ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Assign class teacher</h2>
                <p className="text-sm text-slate-500">{supervisorPanelClass.name}</p>
              </div>
              <button onClick={() => setSupervisorPanelClass(null)} className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={supervisorSearch} onChange={(e) => setSupervisorSearch(e.target.value)}
                placeholder="Search teachers…"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            {supervisorPanelClass.supervisor_id ? (
              <button
                onClick={() => void assignSupervisor(null)} disabled={assigningSupervisor}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60"
              >
                Remove current class teacher
              </button>
            ) : null}
            <div className="max-h-72 overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {filteredSupervisors.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">No teachers found.</p>
              ) : filteredSupervisors.map((teacher) => {
                const isCurrent = supervisorPanelClass.supervisor_id === teacher.profileId;
                return (
                  <div key={teacher.profileId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{teacher.displayName}</p>
                      <p className="text-xs text-slate-500">{teacher.employeeId ?? "No employee number"}</p>
                    </div>
                    <button
                      onClick={() => void assignSupervisor(teacher.profileId)} disabled={assigningSupervisor || isCurrent}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${isCurrent ? "bg-emerald-100 text-emerald-700 cursor-default" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                    >
                      {isCurrent ? "Current" : "Assign"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* Assign students to class modal */}
      {studentPanelClass ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Manage students</h2>
                <p className="text-sm text-slate-500">
                  {studentPanelClass.name} - {studentsInCurrentClass.length} enrolled
                </p>
              </div>
              <button onClick={() => setStudentPanelClass(null)} className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students by name or number…"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <div className="max-h-[400px] overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {filteredStudentsForPanel.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No students found.</p>
              ) : filteredStudentsForPanel.map((student) => {
                const inThisClass = student.classId === studentPanelClass.id;
                const otherClass = !inThisClass && student.classId
                  ? rows.find((r) => r.id === student.classId)?.name
                  : null;
                return (
                  <div key={student.profileId} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-800">{student.displayName}</p>
                      <p className="text-xs text-slate-500">
                        {student.admissionNumber ?? "No student number"}
                        {otherClass ? ` · Currently in ${otherClass}` : ""}
                        {!student.classId ? " · Unassigned" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => void assignStudentToClass(student.profileId, inThisClass ? null : studentPanelClass.id)}
                      disabled={assigningStudent}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${inThisClass ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}
                    >
                      {inThisClass ? "Remove" : "Enrol"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
