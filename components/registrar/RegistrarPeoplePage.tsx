"use client";

import { useEffect, useMemo, useState } from "react";
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
  type ClassOption,
  type SubjectOption,
  type ProfileRow,
  createUser,
  deleteUser,
  fetchClasses,
  fetchSubjects,
  fetchUsers,
  postRelationship,
  toClassOptions,
  updateUser,
  fetchRelationships,
} from "./registrar-api";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import { getDisplayName } from "@/lib/profile-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = "students" | "teachers" | "parents";

type TeacherAssignment = { id: string; classId: string; subjectId: string };

type UserForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  // student
  admission_number: string;
  class_id: string;
  enrollment_date: string;
  // teacher
  employee_id: string;
  department: string;
  hire_date: string;
  specialization_subject_ids: string[];
  teaching_assignments: TeacherAssignment[];
  supervised_class_ids: string[];
  // parent
  relation_type: string;
  occupation: string;
};

const EMPTY_FORM: UserForm = {
  first_name: "", last_name: "", email: "", phone: "", gender: "", status: "ACTIVE",
  admission_number: "", class_id: "", enrollment_date: "",
  employee_id: "", department: "", hire_date: "",
  specialization_subject_ids: [], teaching_assignments: [], supervised_class_ids: [],
  relation_type: "Mother", occupation: "",
};

const PAGE_SIZE = 10;

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "students", label: "Students" },
  { key: "teachers", label: "Teachers" },
  { key: "parents", label: "Parents" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function newAssignment(): TeacherAssignment {
  return { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, classId: "", subjectId: "" };
}

function dedupeAssignments(list: TeacherAssignment[]) {
  const seen = new Set<string>();
  return list.flatMap((a) => {
    const k = `${a.classId}:${a.subjectId}`;
    if (!a.classId || !a.subjectId || seen.has(k)) return [];
    seen.add(k);
    return [{ classId: a.classId, subjectId: a.subjectId }];
  });
}

function subjectSummary(ids: string[], nameById: Record<string, string>) {
  return ids.map((id) => nameById[id] ?? "").filter(Boolean).join(", ");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = "text", required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200">
        {options.map((o) => <option key={o} value={o}>{o || "-"}</option>)}
      </select>
    </label>
  );
}

function SelectOptionField({ label, value, onChange, options, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: ClassOption[]; placeholder?: string; required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      >
        <option value="">{placeholder ?? "Select…"}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RegistrarPeoplePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("students");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageByTab, setPageByTab] = useState<Record<TabKey, number>>({ students: 1, teachers: 1, parents: 1 });

  const [students, setStudents] = useState<ProfileRow[]>([]);
  const [teachers, setTeachers] = useState<ProfileRow[]>([]);
  const [parents, setParents] = useState<ProfileRow[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRow | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);

  // Parent-student link modal
  const [linkParent, setLinkParent] = useState<ProfileRow | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);

  // Inline teacher assignment helpers
  const [selectedSpecSubjectId, setSelectedSpecSubjectId] = useState("");
  const [selectedSupervisedClassId, setSelectedSupervisedClassId] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    void init();
  }, []);

  async function init() {
    setLoading(true);
    try {
      const [userData, classData, subjectData] = await Promise.all([
        fetchUsers(),
        fetchClasses(),
        fetchSubjects(),
      ]);
      setStudents(userData.students);
      setTeachers(userData.teachers);
      setParents(userData.parents);
      setClassOptions(toClassOptions(classData));
      setSubjectOptions(subjectData);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function reload() {
    try {
      const userData = await fetchUsers();
      setStudents(userData.students);
      setTeachers(userData.teachers);
      setParents(userData.parents);
    } catch { /* silent */ }
  }

  const classNameById = useMemo(
    () => Object.fromEntries(classOptions.map((o) => [o.id, o.label])),
    [classOptions],
  );
  const subjectNameById = useMemo(
    () => Object.fromEntries(subjectOptions.map((o) => [o.id, o.label])),
    [subjectOptions],
  );

  const currentRows = useMemo(() => {
    const rows = activeTab === "students" ? students : activeTab === "teachers" ? teachers : parents;
    if (!debouncedSearch) return rows;
    return rows.filter((row) =>
      [getDisplayName(row), row.email, row.phone, row.admission_number, classNameById[row.class_id], row.employee_id, row.department, row.status]
        .filter(Boolean).join(" ").toLowerCase().includes(debouncedSearch),
    );
  }, [activeTab, students, teachers, parents, debouncedSearch, classNameById]);

  const totalPages = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE));
  const paginatedRows = useMemo(() => {
    const p = pageByTab[activeTab] || 1;
    return currentRows.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE);
  }, [currentRows, pageByTab, activeTab]);

  function openCreate() {
    setEditTarget(null);
    setFormError(null);
    setSelectedSpecSubjectId("");
    setSelectedSupervisedClassId("");
    setForm(activeTab === "teachers" ? { ...EMPTY_FORM, teaching_assignments: [newAssignment()] } : EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: ProfileRow) {
    setEditTarget(row);
    setFormError(null);
    setSelectedSpecSubjectId("");
    setSelectedSupervisedClassId("");
    setForm({
      first_name: row.first_name ?? "",
      last_name: row.last_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      gender: row.gender ?? "",
      status: row.status ?? "ACTIVE",
      admission_number: row.admission_number ?? "",
      class_id: row.class_id ?? "",
      enrollment_date: row.enrollment_date ?? "",
      employee_id: row.employee_id ?? "",
      department: row.department ?? "",
      hire_date: row.hire_date ?? "",
      specialization_subject_ids: [],
      teaching_assignments: [],
      supervised_class_ids: [],
      relation_type: row.relation_type ?? "Mother",
      occupation: row.occupation ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    if (activeTab === "students" && !form.admission_number.trim()) {
      setFormError("Student number is required.");
      return;
    }
    if (activeTab === "students" && !form.class_id) {
      setFormError(classOptions.length ? "Select a class for this student." : "Create at least one class first.");
      return;
    }
    if (activeTab === "teachers" && !form.employee_id.trim()) {
      setFormError("Employee number is required.");
      return;
    }

    const role = activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent";
    const assignments = dedupeAssignments(form.teaching_assignments);
    const specSummary = subjectSummary(form.specialization_subject_ids, subjectNameById);

    setSaving(true);
    const t = toast.loading(editTarget ? "Updating…" : "Creating…");
    try {
      if (editTarget) {
        await updateUser({
          profileId: editTarget.id,
          role,
          firstName: form.first_name.trim(),
          lastName: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          gender: form.gender || null,
          status: form.status,
          admissionNumber: form.admission_number.trim() || null,
          classId: form.class_id || null,
          enrollmentDate: form.enrollment_date || null,
          employeeId: form.employee_id.trim() || null,
          department: form.department.trim() || null,
          specialization: specSummary || null,
          hireDate: form.hire_date || null,
          relationType: form.relation_type || null,
          occupation: form.occupation.trim() || null,
          specializationSubjectIds: form.specialization_subject_ids,
          teachingAssignments: assignments,
          supervisedClassIds: form.supervised_class_ids,
        });
        toast.success("User updated", { id: t });
      } else {
        const res = await createUser({
          role,
          firstName: form.first_name.trim(),
          lastName: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim() || null,
          profileExtras:
            activeTab === "students"
              ? { admission_number: form.admission_number.trim(), class_id: form.class_id || null, enrollment_date: form.enrollment_date || null, gender: form.gender || null, status: form.status }
              : activeTab === "teachers"
              ? { employee_id: form.employee_id.trim(), department: form.department.trim() || null, specialization: specSummary || null, hire_date: form.hire_date || null, gender: form.gender || null, status: form.status }
              : { gender: form.gender || null, status: form.status },
          parentExtras: activeTab === "parents" ? { relation_type: form.relation_type || null, occupation: form.occupation.trim() || null } : undefined,
          specializationSubjectIds: activeTab === "teachers" ? form.specialization_subject_ids : undefined,
          teachingAssignments: activeTab === "teachers" ? assignments : undefined,
          supervisedClassIds: activeTab === "teachers" ? form.supervised_class_ids : undefined,
        });
        if (res.temporaryPassword) {
          setNewCredentials({ email: form.email.trim().toLowerCase(), password: res.temporaryPassword });
        }
        toast.success(res.credentialsEmailSent ? "User created - credentials emailed" : "User created", { id: t });
      }
      setFormOpen(false);
      setEditTarget(null);
      setForm(EMPTY_FORM);
      await reload();
    } catch (err: any) {
      setFormError(err?.message ?? "Failed to save user");
      toast.error(err?.message ?? "Failed to save user", { id: t });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: ProfileRow) {
    if (!window.confirm(`Delete ${getDisplayName(row)}? This cannot be undone.`)) return;
    const role = activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent";
    setDeleting(row.id);
    const t = toast.loading("Deleting…");
    try {
      await deleteUser(row.id, role);
      await reload();
      toast.success("User deleted", { id: t });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete user", { id: t });
    } finally {
      setDeleting(null);
    }
  }

  async function openLinkModal(row: ProfileRow) {
    setLinkParent(row);
    setLinkSearch("");
    setLinkedStudentIds([]);
    try {
      const rel = await fetchRelationships();
      const match = rel.parents.find((p) => p.profileId === row.id);
      setLinkedStudentIds(match?.linkedStudentProfileIds ?? []);
    } catch { /* silent */ }
  }

  async function toggleLink(studentId: string, shouldLink: boolean) {
    if (!linkParent) return;
    setLinking(true);
    const t = toast.loading(shouldLink ? "Linking…" : "Removing link…");
    try {
      await postRelationship({
        action: shouldLink ? "link_parent_student" : "unlink_parent_student",
        parentProfileId: linkParent.id,
        studentProfileId: studentId,
      });
      setLinkedStudentIds((prev) =>
        shouldLink ? Array.from(new Set([...prev, studentId])) : prev.filter((id) => id !== studentId),
      );
      toast.success(shouldLink ? "Student linked" : "Link removed", { id: t });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update link", { id: t });
    } finally {
      setLinking(false);
    }
  }

  const linkCandidates = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    return students
      .map((s) => ({ id: s.id, name: getDisplayName(s), admission: s.admission_number }))
      .filter((s) => !q || `${s.name} ${s.admission ?? ""}`.toLowerCase().includes(q));
  }, [students, linkSearch]);

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading users…</p>
        </div>
      </div>
    );
  }

  const counts = { students: students.length, teachers: teachers.length, parents: parents.length };

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 px-6 py-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Registrar workspace</p>
        <h1 className="mt-2 text-2xl font-semibold">People</h1>
        <p className="mt-1 text-sm text-slate-400">
          Add students, parents, and teachers with the Add button and tabs below.
          Invite Deputy Head, Bursar, Registrar, and other office staff in Staff
          invitations (Head Teacher) - not through Add student/teacher/parent.
          Link parents to their children from the Parents tab.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPageByTab((p) => ({ ...p, [activeTab]: 1 })); }}
              placeholder="Search directory"
              className="w-52 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-300/50"
            />
          </div>
          <button
            type="button" onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" />
            Add {activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {TABS.map((tab) => {
            const active = tab.key === activeTab;
            return (
              <button
                key={tab.key} type="button"
                onClick={() => { setActiveTab(tab.key); setSearch(""); }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors ${active ? "bg-emerald-600 font-semibold text-white shadow-sm" : "font-medium text-slate-600 hover:bg-gray-50"}`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {counts[tab.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Email</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</th>
                {activeTab === "students" && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Student No</th>}
                {activeTab === "students" && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Class</th>}
                {activeTab === "teachers" && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Employee No</th>}
                {activeTab === "teachers" && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Department</th>}
                {activeTab === "parents" && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Relation</th>}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    {debouncedSearch ? "No users match your search." : `No ${activeTab} yet. Use Add to create one.`}
                  </td>
                </tr>
              ) : paginatedRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{getDisplayName(row)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.email || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.phone || "-"}</td>
                  {activeTab === "students" && <td className="px-4 py-3 text-slate-600">{row.admission_number || "-"}</td>}
                  {activeTab === "students" && <td className="px-4 py-3 text-slate-600">{classNameById[row.class_id] || row.class_name || "-"}</td>}
                  {activeTab === "teachers" && <td className="px-4 py-3 text-slate-600">{row.employee_id || "-"}</td>}
                  {activeTab === "teachers" && <td className="px-4 py-3 text-slate-600">{row.department || "-"}</td>}
                  {activeTab === "parents" && <td className="px-4 py-3 text-slate-600">{row.relation_type || "-"}</td>}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ${String(row.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      <UserCheck className="w-3.5 h-3.5" />
                      {String(row.status || "ACTIVE").toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end items-center gap-2">
                      {activeTab === "parents" && (
                        <button onClick={() => void openLinkModal(row)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-gray-50">
                          Link students
                        </button>
                      )}
                      <button onClick={() => openEdit(row)} className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center hover:bg-slate-200">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => void handleDelete(row)} disabled={deleting === row.id} className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center hover:bg-red-100 disabled:opacity-60">
                        {deleting === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">Showing {paginatedRows.length} of {currentRows.length}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPageByTab((p) => ({ ...p, [activeTab]: Math.max(1, (p[activeTab] || 1) - 1) }))} disabled={(pageByTab[activeTab] || 1) <= 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50">Prev</button>
            <span className="text-xs text-slate-600">Page {pageByTab[activeTab] || 1} / {totalPages}</span>
            <button onClick={() => setPageByTab((p) => ({ ...p, [activeTab]: Math.min(totalPages, (p[activeTab] || 1) + 1) }))} disabled={(pageByTab[activeTab] || 1) >= totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>

      {/* Create / Edit form modal */}
      {formOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
            <div role="dialog" aria-modal="true" className="w-full max-w-4xl max-h-[92vh] min-h-0 overflow-hidden rounded-[28px] bg-white border border-slate-200 shadow-2xl flex flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {editTarget ? "Edit" : "Create"} {activeTab === "students" ? "Student" : activeTab === "teachers" ? "Teacher" : "Parent"}
                  </h2>
                  {formError ? (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800">{formError}</div>
                  ) : null}
                </div>
                <button type="button" onClick={() => setFormOpen(false)} className="w-9 h-9 rounded-2xl border border-slate-200 bg-white grid place-items-center text-slate-600 hover:bg-slate-50">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {/* No classes warning */}
                {(activeTab === "students" || activeTab === "teachers") && classOptions.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    No classes exist yet. Go to <strong>Classes</strong> to create them first, then return here.
                  </div>
                ) : null}

                {/* Core fields */}
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="First name" value={form.first_name} onChange={(v) => setForm((p) => ({ ...p, first_name: v }))} required />
                  <Field label="Last name" value={form.last_name} onChange={(v) => setForm((p) => ({ ...p, last_name: v }))} required />
                  <Field label="Email" type="email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} required />
                  <Field label="Phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
                  <SelectField label="Gender" value={form.gender} onChange={(v) => setForm((p) => ({ ...p, gender: v }))} options={["", "male", "female"]} />
                  <SelectField label="Status" value={form.status} onChange={(v) => setForm((p) => ({ ...p, status: v }))} options={["ACTIVE", "INACTIVE", "TRANSFERRED", "WITHDRAWN"]} />

                  {/* Student fields */}
                  {activeTab === "students" ? (
                    <>
                      <Field label="Student number" value={form.admission_number} onChange={(v) => setForm((p) => ({ ...p, admission_number: v }))} required />
                      <SelectOptionField label="Class" value={form.class_id} onChange={(v) => setForm((p) => ({ ...p, class_id: v }))} options={classOptions} placeholder="Select class (required)" required />
                      <DateOnlyPicker
                        label="Enrollment date"
                        value={form.enrollment_date}
                        onChange={(v) => setForm((p) => ({ ...p, enrollment_date: v }))}
                        placeholder="When did they enroll?"
                      />
                    </>
                  ) : null}

                  {/* Teacher fields */}
                  {activeTab === "teachers" ? (
                    <>
                      <Field label="Employee number" value={form.employee_id} onChange={(v) => setForm((p) => ({ ...p, employee_id: v }))} required />
                      <Field label="Department" value={form.department} onChange={(v) => setForm((p) => ({ ...p, department: v }))} />
                      <DateOnlyPicker
                        label="Hire date"
                        value={form.hire_date}
                        onChange={(v) => setForm((p) => ({ ...p, hire_date: v }))}
                        placeholder="When were they hired?"
                      />
                    </>
                  ) : null}

                  {/* Parent fields */}
                  {activeTab === "parents" ? (
                    <>
                      <Field label="Relation type" value={form.relation_type} onChange={(v) => setForm((p) => ({ ...p, relation_type: v }))} />
                      <Field label="Occupation" value={form.occupation} onChange={(v) => setForm((p) => ({ ...p, occupation: v }))} />
                    </>
                  ) : null}
                </div>

                {/* Teacher assignments section */}
                {activeTab === "teachers" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-5">
                    <h3 className="text-sm font-semibold text-slate-900">Teaching assignments</h3>

                    {/* Subject specializations */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-700">Subject specializations</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <SelectOptionField label="" value={selectedSpecSubjectId} onChange={setSelectedSpecSubjectId} options={subjectOptions} placeholder="Select subject" />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedSpecSubjectId) return;
                            setForm((p) => ({
                              ...p,
                              specialization_subject_ids: p.specialization_subject_ids.includes(selectedSpecSubjectId)
                                ? p.specialization_subject_ids
                                : [...p.specialization_subject_ids, selectedSpecSubjectId],
                            }));
                            setSelectedSpecSubjectId("");
                          }}
                          className="mt-0 self-end inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.specialization_subject_ids.length === 0
                          ? <p className="text-xs text-slate-500">No subjects selected.</p>
                          : form.specialization_subject_ids.map((id) => (
                            <button key={id} type="button"
                              onClick={() => setForm((p) => ({ ...p, specialization_subject_ids: p.specialization_subject_ids.filter((v) => v !== id) }))}
                              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700"
                            >
                              {subjectNameById[id] ?? id} <X className="w-3 h-3" />
                            </button>
                          ))}
                      </div>
                    </div>

                    {/* Teaching assignments (class + subject rows) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-slate-700">Class teaching assignments</p>
                        <button type="button" onClick={() => setForm((p) => ({ ...p, teaching_assignments: [...p.teaching_assignments, newAssignment()] }))}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                          <Plus className="w-3.5 h-3.5" /> Add row
                        </button>
                      </div>
                      {form.teaching_assignments.length === 0
                        ? <p className="text-xs text-slate-500">No teaching assignments yet.</p>
                        : form.teaching_assignments.map((a, i) => (
                          <div key={a.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                            <SelectOptionField label={`Class ${i + 1}`} value={a.classId} onChange={(v) => setForm((p) => ({ ...p, teaching_assignments: p.teaching_assignments.map((x) => x.id === a.id ? { ...x, classId: v } : x) }))} options={classOptions} placeholder="Select class" />
                            <SelectOptionField label="Subject" value={a.subjectId} onChange={(v) => setForm((p) => ({ ...p, teaching_assignments: p.teaching_assignments.map((x) => x.id === a.id ? { ...x, subjectId: v } : x) }))} options={subjectOptions} placeholder="Select subject" />
                            <button type="button" onClick={() => setForm((p) => ({ ...p, teaching_assignments: p.teaching_assignments.filter((x) => x.id !== a.id) }))}
                              className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100">
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Class teacher responsibilities */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-700">Class teacher responsibilities</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <SelectOptionField label="" value={selectedSupervisedClassId} onChange={setSelectedSupervisedClassId} options={classOptions} placeholder="Select class" />
                        </div>
                        <button type="button"
                          onClick={() => {
                            if (!selectedSupervisedClassId) return;
                            setForm((p) => ({
                              ...p,
                              supervised_class_ids: p.supervised_class_ids.includes(selectedSupervisedClassId)
                                ? p.supervised_class_ids
                                : [...p.supervised_class_ids, selectedSupervisedClassId],
                            }));
                            setSelectedSupervisedClassId("");
                          }}
                          className="self-end inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {form.supervised_class_ids.length === 0
                          ? <p className="text-xs text-slate-500">No class teacher roles selected.</p>
                          : form.supervised_class_ids.map((id) => (
                            <button key={id} type="button"
                              onClick={() => setForm((p) => ({ ...p, supervised_class_ids: p.supervised_class_ids.filter((v) => v !== id) }))}
                              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
                            >
                              {classNameById[id] ?? id} <X className="w-3 h-3" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
                <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={() => void handleSave()} disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-400 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {editTarget ? "Save changes" : `Create ${activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Parent-student link modal */}
      {linkParent ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Link students to {getDisplayName(linkParent)}</h2>
                <p className="text-sm text-slate-500">{linkedStudentIds.length} student{linkedStudentIds.length === 1 ? "" : "s"} currently linked</p>
              </div>
              <button onClick={() => setLinkParent(null)} className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)} placeholder="Search students by name or number"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200" />
            </div>
            <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {linkCandidates.length === 0
                ? <div className="px-4 py-8 text-center text-sm text-slate-500">No students found.</div>
                : linkCandidates.map((student) => {
                  const linked = linkedStudentIds.includes(student.id);
                  return (
                    <div key={student.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">{student.admission ?? "No student number"}</p>
                      </div>
                      <button onClick={() => void toggleLink(student.id, !linked)} disabled={linking}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${linked ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                        {linked ? "Unlink" : "Link"}
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : null}

      {/* New credentials modal */}
      {newCredentials ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">New account credentials</h2>
              <button onClick={() => setNewCredentials(null)} className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-slate-600">Share these credentials securely. The user must change the password on first login.</p>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-sm">
              <div><span className="text-slate-500">Email: </span><span className="font-medium text-slate-800">{newCredentials.email}</span></div>
              <div><span className="text-slate-500">Temporary password: </span><span className="font-mono font-medium text-slate-800">{newCredentials.password}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`Email: ${newCredentials.email}\nTemporary password: ${newCredentials.password}`);
                  toast.success("Copied");
                } catch { toast.error("Copy failed"); }
              }} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50">Copy</button>
              <button onClick={() => setNewCredentials(null)} className="px-4 py-2 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-400">Done</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
