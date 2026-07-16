"use client";

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

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 280;

type SubjectRow = {
  id: string;
  name: string;
  code?: string | null;
};

const EMPTY_FORM = {
  name: "",
  code: "",
};

export default function AdminSubjectsPage() {
  const searchParams = useSearchParams();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<SubjectRow[]>([]);
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
      const data = await adminGet("/api/admin/subjects");
      setRows(data?.data || data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load subjects");
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
      const haystack = [row.name, row.code || ""].join(" ").toLowerCase();
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
      withCode: rows.filter((row) => row.code && row.code.trim()).length,
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

  const openEdit = (row: SubjectRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) {
      toast.error("Subject name is required");
      return;
    }

    const payload: Record<string, unknown> = { name };
    if (form.code.trim()) payload.code = form.code.trim();

    setSaving(true);
    const toastId = toast.loading(editingId ? "Updating subject..." : "Creating subject...");

    try {
      if (editingId) {
        await adminRequest("/api/admin/subjects", {
          method: "PUT",
          body: JSON.stringify({ id: editingId, ...payload }),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Subject updated", { id: toastId });
      } else {
        await adminPost("/api/admin/subjects", payload);
        toast.success("Subject created", { id: toastId });
      }
      resetForm();
      await load({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save subject", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SubjectRow) => {
    if (!window.confirm(`Delete "${row.name}"?`)) {
      return;
    }

    setSaving(true);
    try {
      await adminDelete(`/api/admin/subjects?id=${encodeURIComponent(row.id)}`);
      setRows((current) => current.filter((item) => item.id !== row.id));
      toast.success("Subject deleted");
      if (editingId === row.id) resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subject");
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
          <p className="text-sm font-medium text-slate-500">Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Curriculum"
        title="Subjects"
        description="Create and manage the subject catalog. Teachers and assignments reference these subjects."
        accent="slate"
        actions={
          <button
            type="button"
            onClick={() => (formOpen ? resetForm() : openCreate())}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? "Close" : "Add subject"}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total subjects" value={stats.total} />
        <StatCard label="With subject code" value={stats.withCode} />
        <StatCard label="Matching search" value={stats.shown} />
      </div>

      {formOpen ? (
        <section className={`${messageSurfaceClass} p-5 sm:p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? "Edit subject" : "New subject"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {editingId
                  ? "Update the subject details below."
                  : "Add a subject to the curriculum catalog."}
              </p>
            </div>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close form"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-1">
              <span className={messageLabelClass}>Subject name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Mathematics"
                className={messageFieldClass}
                autoFocus
              />
            </label>
            <label>
              <span className={messageLabelClass}>Subject code (optional)</span>
              <input
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. MATH101"
                className={messageFieldClass}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSubmit()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-55"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {editingId ? "Save changes" : "Create subject"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200/90 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className={messageSurfaceClass}>
        <div className="flex flex-col gap-3 border-b border-slate-100/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">All subjects</h2>
            <p className="mt-0.5 text-xs tabular-nums text-slate-500">
              {filtered.length} subject{filtered.length === 1 ? "" : "s"}
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
              placeholder="Search subjects..."
              aria-label="Search subjects"
              className={`${messageFieldClass} pl-10 pr-9`}
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
              {debouncedSearch ? "No subjects match" : "No subjects yet"}
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              {debouncedSearch
                ? "Try another name or code."
                : "Create your first subject to start building the curriculum catalog."}
            </p>
            {!debouncedSearch ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add subject
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
                        <span className="font-medium text-slate-600">Code:</span>{" "}
                        {row.code || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDelete(row)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
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
