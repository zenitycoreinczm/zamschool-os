"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { adminApiJson } from "@/lib/admin-browser-api";
import type {
  DepartmentStaffOption,
  EnrichedDepartment,
} from "@/lib/departments-workspace";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton, surface } from "@/lib/workspace/design";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { normalizeRole } from "@/lib/roles";

type FilterKey = "all" | "needs_head" | "has_head" | "default" | "custom";

const EMPTY_FORM = {
  name: "",
  description: "",
  head_of_department: "",
};

export default function DepartmentsWorkspace() {
  const { role: workspaceRole } = useWorkspaceContext();
  const isHr = normalizeRole(workspaceRole) === "HR_ADMIN";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<EnrichedDepartment[]>([]);
  const [staffOptions, setStaffOptions] = useState<DepartmentStaffOption[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [quickAssignId, setQuickAssignId] = useState<string | null>(null);
  const [quickAssignSaving, setQuickAssignSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const canSave = useMemo(() => form.name.trim().length >= 2, [form.name]);

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setLoading(true);
    try {
      const body = await adminApiJson<{
        data?: EnrichedDepartment[];
        meta?: {
          staffOptions?: DepartmentStaffOption[];
        };
      }>("/api/school/departments");
      setDepartments(Array.isArray(body.data) ? body.data : []);
      setStaffOptions(
        Array.isArray(body.meta?.staffOptions) ? body.meta!.staffOptions! : [],
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load departments";
      toast.error(message);
      if (!opts?.soft) {
        setDepartments([]);
        setStaffOptions([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const withHead = departments.filter((d) => d.head_of_department).length;
    const membersLinked = departments.reduce(
      (sum, d) => sum + (d.member_count || 0),
      0,
    );
    return {
      total: departments.length,
      withHead,
      withoutHead: departments.length - withHead,
      membersLinked,
      staffEligible: staffOptions.length,
    };
  }, [departments, staffOptions.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((dept) => {
      if (filter === "needs_head" && dept.head_of_department) return false;
      if (filter === "has_head" && !dept.head_of_department) return false;
      if (filter === "default" && !dept.is_default) return false;
      if (filter === "custom" && dept.is_default) return false;
      if (!q) return true;
      const headLabel = dept.head?.label || "";
      return (
        dept.name.toLowerCase().includes(q) ||
        String(dept.description || "")
          .toLowerCase()
          .includes(q) ||
        headLabel.toLowerCase().includes(q)
      );
    });
  }, [departments, filter, search]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const startEdit = (row: EnrichedDepartment) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description || "",
      head_of_department: row.head_of_department || "",
    });
    setFormOpen(true);
  };

  const saveDepartment = async () => {
    if (!canSave) {
      toast.error("Department name must be at least 2 characters");
      return;
    }

    setSaving(true);
    const toastId = toast.loading(
      editingId ? "Updating department…" : "Creating department…",
    );
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        head_of_department: form.head_of_department || null,
      };

      if (editingId) {
        await adminApiJson("/api/school/departments", {
          method: "PATCH",
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await adminApiJson("/api/school/departments", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      await load({ soft: true });
      resetForm();
      toast.success(editingId ? "Department updated" : "Department created", {
        id: toastId,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save department";
      toast.error(message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const quickAssignHead = async (deptId: string, headId: string) => {
    setQuickAssignSaving(true);
    const toastId = toast.loading("Updating head…");
    try {
      await adminApiJson("/api/school/departments", {
        method: "PATCH",
        body: JSON.stringify({
          id: deptId,
          head_of_department: headId || null,
        }),
      });
      await load({ soft: true });
      setQuickAssignId(null);
      toast.success(headId ? "Head assigned" : "Head cleared", { id: toastId });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to assign head";
      toast.error(message, { id: toastId });
    } finally {
      setQuickAssignSaving(false);
    }
  };

  const deleteDepartment = async (row: EnrichedDepartment) => {
    if (row.is_default) {
      toast.error("Default departments cannot be deleted");
      return;
    }
    if (!window.confirm(`Delete department "${row.name}"?`)) return;

    const toastId = toast.loading("Deleting department…");
    try {
      await adminApiJson(
        `/api/school/departments?id=${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      await load({ soft: true });
      if (editingId === row.id) resetForm();
      toast.success("Department deleted", { id: toastId });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete department";
      toast.error(message, { id: toastId });
    }
  };

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-500"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading departments…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <AdminPageHero
        eyebrow={isHr ? "People desk" : "School structure"}
        title="Departments"
        description={
          isHr
            ? "Own school structure: create departments, assign heads, and keep staffing aligned with employment records."
            : "Maintain school structure and heads of department."
        }
        accent={isHr ? "slate" : "sky"}
        stats={[
          {
            label: "Departments",
            value: stats.total,
            hint: "School structure",
            tone: "slate",
          },
          {
            label: "With heads",
            value: stats.withHead,
            hint: "Ownership clear",
            tone: "emerald",
          },
          {
            label: "Need heads",
            value: stats.withoutHead,
            hint: stats.withoutHead > 0 ? "Assign owners" : "All set",
            tone: stats.withoutHead > 0 ? "amber" : "slate",
          },
          {
            label: "Teachers linked",
            value: stats.membersLinked,
            hint: `${stats.staffEligible} staff can lead`,
            tone: "violet",
          },
        ]}
        actions={
          <>
            <button
              type="button"
              onClick={() => void load({ soft: true })}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
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
              onClick={openCreate}
              className={primaryButton(
                "bg-brand hover:bg-brand-hover shadow-none",
              )}
            >
              <Plus className="h-4 w-4" />
              Add department
            </button>
          </>
        }
      />

      {isHr ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">How departments connect</p>
          <p className="mt-1 leading-relaxed">
            Assign a head from any staff account (teachers and office roles).
            Teacher employment records can use these department names — keep
            names stable so counts stay accurate. Staff invites remain with the{" "}
            <span className="font-medium text-slate-800">Head Teacher</span>.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/app/admin/users"
              className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline-offset-2 hover:underline"
            >
              Staff directory
            </Link>
          </div>
        </div>
      ) : null}

      {staffOptions.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">No staff available to assign as heads</p>
          <p className="mt-1">
            Heads appear after the Head Teacher’s invitations are accepted.
            You can still create and name departments now.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search departments or heads…"
            aria-label="Search departments"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter departments">
          {(
            [
              ["all", "All"],
              ["needs_head", "Need head"],
              ["has_head", "Has head"],
              ["default", "Default"],
              ["custom", "Custom"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                filter === key
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
              {key === "needs_head" && stats.withoutHead > 0
                ? ` (${stats.withoutHead})`
                : ""}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {formOpen ? (
          <div className={cn(surface("default"), "p-5")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {editingId ? "Edit" : "New"}
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-slate-900">
                  {editingId ? "Edit department" : "Add department"}
                </h2>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Name
                </span>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. Sciences"
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Description
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="min-h-[80px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Optional summary of this unit"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Head of department
                </span>
                <select
                  value={form.head_of_department}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      head_of_department: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <option value="">Not assigned</option>
                  {staffOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {staffOptions.length === 0 ? (
                  <span className="mt-1 block text-[11px] text-slate-400">
                    No staff on the system yet — leave unassigned for now.
                  </span>
                ) : null}
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveDepartment()}
                disabled={!canSave || saving}
                className={primaryButton(
                  "bg-slate-900 hover:bg-slate-800 disabled:opacity-60",
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {editingId ? "Save changes" : "Add department"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className={secondaryButton()}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCreate}
            className={cn(
              surface("dashed"),
              "flex min-h-[200px] flex-col items-center justify-center gap-2 p-6 text-center transition hover:border-slate-300 hover:bg-slate-50/50",
            )}
          >
            <p className="font-semibold text-slate-900">Add a department</p>
            <p className="max-w-[220px] text-sm text-slate-500">
              Create structure for subjects, teams, and heads of department.
            </p>
          </button>
        )}

        <div className={cn(surface("default"), "overflow-hidden")}>
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-semibold text-slate-800">
                {departments.length === 0
                  ? "No departments yet"
                  : "No departments match"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {departments.length === 0
                  ? "Run school initialization or add your first department."
                  : "Try another search or filter."}
              </p>
              {departments.length === 0 ? (
                <button
                  type="button"
                  onClick={openCreate}
                  className={cn(primaryButton(), "mt-4")}
                >
                  <Plus className="h-4 w-4" />
                  Add department
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Head</th>
                      <th className="px-4 py-3">Teachers</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50/70"
                      >
                        <td className="px-4 py-3 align-top">
                          <p className="font-semibold text-slate-900">
                            {row.name}
                          </p>
                          {row.description ? (
                            <p className="mt-0.5 max-w-xs text-xs text-slate-500 line-clamp-2">
                              {row.description}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {quickAssignId === row.id ? (
                            <div className="flex min-w-[180px] flex-col gap-1.5">
                              <select
                                autoFocus
                                disabled={quickAssignSaving}
                                defaultValue={row.head_of_department || ""}
                                onChange={(e) =>
                                  void quickAssignHead(row.id, e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                              >
                                <option value="">Not assigned</option>
                                {staffOptions.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="text-xs font-medium text-slate-500 hover:text-slate-800"
                                onClick={() => setQuickAssignId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div>
                              <p
                                className={cn(
                                  "font-medium",
                                  row.head
                                    ? "text-slate-800"
                                    : "text-amber-800",
                                )}
                              >
                                {row.head?.label || "Unassigned"}
                              </p>
                              {row.head?.role ? (
                                <p className="text-[11px] text-slate-400">
                                  {row.head.role.replace(/_/g, " ")}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top tabular-nums text-slate-600">
                          {row.member_count}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              row.is_default
                                ? "bg-slate-100 text-slate-600"
                                : "bg-sky-50 text-sky-800",
                            )}
                          >
                            {row.is_default ? "Default" : "Custom"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setQuickAssignId((cur) =>
                                  cur === row.id ? null : row.id,
                                )
                              }
                              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              aria-label={`Assign head for ${row.name}`}
                              title="Assign head"
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                              aria-label={`Edit ${row.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteDepartment(row)}
                              disabled={Boolean(row.is_default)}
                              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                              aria-label={`Delete ${row.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {filtered.map((row) => (
                  <li key={row.id} className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{row.name}</p>
                        {row.description ? (
                          <p className="mt-0.5 text-xs text-slate-500">
                            {row.description}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          row.is_default
                            ? "bg-slate-100 text-slate-600"
                            : "bg-sky-50 text-sky-800",
                        )}
                      >
                        {row.is_default ? "Default" : "Custom"}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">
                      Head:{" "}
                      <span className="font-medium text-slate-900">
                        {row.head?.label || "Unassigned"}
                      </span>
                      {" · "}
                      {row.member_count} teacher
                      {row.member_count === 1 ? "" : "s"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setQuickAssignId((cur) =>
                            cur === row.id ? null : row.id,
                          )
                        }
                        className={secondaryButton("flex-1 justify-center text-xs")}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Head
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className={secondaryButton("flex-1 justify-center text-xs")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      {!row.is_default ? (
                        <button
                          type="button"
                          onClick={() => void deleteDepartment(row)}
                          className="grid h-9 w-9 place-items-center rounded-xl border border-rose-200 text-rose-600"
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    {quickAssignId === row.id ? (
                      <select
                        disabled={quickAssignSaving}
                        defaultValue={row.head_of_department || ""}
                        onChange={(e) =>
                          void quickAssignHead(row.id, e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Not assigned</option>
                        {staffOptions.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
