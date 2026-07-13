"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/workspace/PageHeader";
import {
  messageFieldClass,
  messageLabelClass,
  messageSurfaceClass,
} from "@/components/messages/message-ui";
import Pagination from "@/components/Pagination";
import { adminDelete, adminGet, adminPost, adminRequest } from "@/lib/admin-route-client";
import { getDisplayName } from "@/lib/profile-utils";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

// Roles that own the class entity (create/edit/delete). Everyone else with
// access to this page (e.g. Academic Admin, Discipline Admin) gets a
// read-only view — classes are created and managed by the Registrar.
const CLASS_MANAGER_ROLES = new Set([
  "principal",
  "super_admin",
  "registrar",
]);

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 280;

type ClassRow = {
  id: string;
  name: string;
  grade_level?: number | null;
  capacity?: number | null;
  supervisor_id?: string | null;
  grades?: { name?: string; level?: number | null } | null;
  profiles?: { first_name?: string; last_name?: string; email?: string } | null;
};

const EMPTY_FORM = {
  name: "",
  gradeLevel: "",
  capacity: "30",
};

function normalizeClassRows(payload: unknown): ClassRow[] {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { data?: unknown })?.data)
      ? (payload as { data: ClassRow[] }).data
      : [];

  return list
    .filter((row): row is ClassRow => Boolean(row && typeof row.id === "string"))
    .map((row) => ({
      id: row.id,
      name: String(row.name || "").trim(),
      grade_level: row.grade_level ?? row.grades?.level ?? null,
      capacity: row.capacity ?? null,
      supervisor_id: row.supervisor_id ?? null,
      grades: row.grades ?? null,
      profiles: row.profiles ?? null,
    }));
}

function gradeLabel(row: ClassRow) {
  if (row.grades?.name) return row.grades.name;
  if (row.grade_level != null) {
    return `Grade ${row.grade_level}`;
  }
  return "—";
}

function supervisorLabel(row: ClassRow) {
  if (!row.profiles) return "Not assigned";
  const name = getDisplayName(row.profiles);
  return name && name !== "User" ? name : "Not assigned";
}

export default function AdminClassesPage() {
  const searchParams = useSearchParams();
  const { role } = useWorkspaceContext();
  const canManageClasses = Boolean(role && CLASS_MANAGER_ROLES.has(role));
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    const nextQuery = (searchParams.get("q") || "").trim();
    if (nextQuery) {
      setSearchInput(nextQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toLowerCase());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    try {
      const payload = await adminGet("/api/admin/classes");
      setRows(normalizeClassRows(payload));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load classes");
    } finally {
      if (silent) setRefreshing(false);
      else setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((row) => {
      const haystack = [row.name, gradeLabel(row), supervisorLabel(row), String(row.capacity ?? "")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [rows, debouncedSearch]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      withSupervisor: rows.filter((row) => row.supervisor_id).length,
      shown: filtered.length,
    }),
    [rows, filtered.length]
  );

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (row: ClassRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      gradeLevel: row.grade_level != null ? String(row.grade_level) : "",
      capacity: row.capacity != null ? String(row.capacity) : "30",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Class name is required");
      return;
    }

    const payload: Record<string, unknown> = { name };
    if (form.gradeLevel.trim()) payload.gradeLevel = Number(form.gradeLevel);
    if (form.capacity.trim()) payload.capacity = Number(form.capacity);

    setSaving(true);
    const toastId = toast.loading(editingId ? "Updating class…" : "Creating class…");

    try {
      if (editingId) {
        await adminRequest("/api/admin/classes", {
          method: "PUT",
          body: JSON.stringify({ id: editingId, ...payload }),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Class updated", { id: toastId });
      } else {
        await adminPost("/api/admin/classes", payload);
        toast.success("Class created", { id: toastId });
      }
      resetForm();
      await load({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save class", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: ClassRow) => {
    if (!window.confirm(`Delete "${row.name}"? Students and teachers must be reassigned first.`)) {
      return;
    }

    setSaving(true);
    try {
      await adminDelete(`/api/admin/classes?id=${encodeURIComponent(row.id)}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success("Class deleted");
      if (editingId === row.id) resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete class");
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden />
          <p className="text-sm font-medium text-slate-500">Loading classes…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="School structure"
        title="Classes"
        description={
          canManageClasses
            ? "Create and manage class groups. Assign students and teachers from Users after classes exist."
            : "View class groups, capacities, and class teacher assignments. Classes are created and managed by the Registrar."
        }
        accent="slate"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              Users
            </Link>
            {canManageClasses ? (
              <button
                type="button"
                onClick={() => (formOpen ? resetForm() : openCreate())}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {formOpen ? "Close" : "Add class"}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total classes" value={stats.total} />
        <StatCard label="With class teacher" value={stats.withSupervisor} />
        <StatCard label="Matching search" value={stats.shown} />
      </div>

      {canManageClasses && formOpen ? (
        <section className={`${messageSurfaceClass} p-5 sm:p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? "Edit class" : "New class"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {editingId
                  ? "Update the class details below."
                  : "Add a class before enrolling students or assigning teachers."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="md:col-span-2">
              <span className={messageLabelClass}>Class name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Grade 8A"
                className={messageFieldClass}
                autoFocus
              />
            </label>
            <label>
              <span className={messageLabelClass}>Grade level</span>
              <input
                type="number"
                min={1}
                max={13}
                value={form.gradeLevel}
                onChange={(e) => setForm((prev) => ({ ...prev, gradeLevel: e.target.value }))}
                placeholder="8"
                className={messageFieldClass}
              />
            </label>
            <label>
              <span className={messageLabelClass}>Capacity</span>
              <input
                type="number"
                min={1}
                max={200}
                value={form.capacity}
                onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
                className={messageFieldClass}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-55"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {editingId ? "Save changes" : "Create class"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200/90 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className={messageSurfaceClass}>
        <div className="flex flex-col gap-3 border-b border-slate-100/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">All classes</h2>
            <p className="mt-0.5 text-xs tabular-nums text-slate-500">
              {filtered.length} class{filtered.length === 1 ? "" : "es"}
              {debouncedSearch ? " matching search" : ""}
            </p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search classes…"
              aria-label="Search classes"
              className={`${messageFieldClass} pl-10 pr-9`}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {refreshing ? (
              <Loader2
                className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-800">
              {debouncedSearch ? "No classes match" : "No classes yet"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              {debouncedSearch
                ? "Try another name or grade level."
                : canManageClasses
                  ? "Create your first class, then assign students and teachers from Users."
                  : "The Registrar hasn't created any classes yet."}
            </p>
            {!debouncedSearch && canManageClasses ? (
              <button
                type="button"
                onClick={openCreate}
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
              {pageRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                      {row.name}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        <span className="font-medium text-slate-600">Grade:</span> {gradeLabel(row)}
                      </span>
                      <span className="tabular-nums">
                        <span className="font-medium text-slate-600">Capacity:</span>{" "}
                        {row.capacity ?? "—"}
                      </span>
                      <span>
                        <span className="font-medium text-slate-600">Class teacher:</span>{" "}
                        {supervisorLabel(row)}
                      </span>
                    </div>
                  </div>
                  {canManageClasses ? (
                    <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDelete(row)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {filtered.length > PAGE_SIZE ? (
              <div className="border-t border-slate-100 px-2 py-1">
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={filtered.length}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={`${messageSurfaceClass} px-4 py-3.5`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
    </div>
  );
}