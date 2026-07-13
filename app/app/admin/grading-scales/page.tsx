"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Pencil,
  Plus,
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
import { adminDelete, adminGet, adminPost, adminRequest } from "@/lib/admin-route-client";
import {
  analyzeScaleCoverage,
  bandTone,
  GRADING_PRESETS,
  type ScalePreset,
} from "@/lib/grading-scale-utils";

type ScaleRow = {
  id: string;
  name: string;
  min_score: number;
  max_score: number;
  grade: string;
  description: string | null;
};

const EMPTY_FORM = {
  grade: "",
  minScore: "",
  maxScore: "",
  description: "",
};

export default function AdminGradingScalesPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);
  const [scales, setScales] = useState<ScaleRow[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setRefreshing(true);
    else setInitialLoading(true);

    try {
      const data = await adminGet("/api/admin/grading-scales");
      setScales(Array.isArray(data?.data) ? data.data : []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load grading scales");
      setScales([]);
    } finally {
      if (silent) setRefreshing(false);
      else setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedScales = useMemo(
    () => [...scales].sort((a, b) => b.min_score - a.min_score),
    [scales],
  );

  const coverage = useMemo(
    () =>
      analyzeScaleCoverage(
        scales.map((row) => ({
          min_score: row.min_score,
          max_score: row.max_score,
          grade: row.grade,
        })),
      ),
    [scales],
  );

  const stats = useMemo(
    () => ({
      total: scales.length,
      coverage: coverage.coveragePercent,
      issues: coverage.gaps.length + coverage.overlaps.length,
    }),
    [scales.length, coverage],
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

  const openEdit = (row: ScaleRow) => {
    setEditingId(row.id);
    setForm({
      grade: row.grade,
      minScore: String(row.min_score),
      maxScore: String(row.max_score),
      description: row.description || "",
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    const grade = form.grade.trim();
    const minScore = Number(form.minScore);
    const maxScore = Number(form.maxScore);

    if (!grade) {
      toast.error("Grade label is required");
      return;
    }

    if (
      !Number.isFinite(minScore) ||
      !Number.isFinite(maxScore) ||
      minScore < 0 ||
      maxScore < 0 ||
      minScore > maxScore
    ) {
      toast.error("Enter a valid score range (0–100)");
      return;
    }

    const payload: Record<string, unknown> = {
      grade,
      minScore,
      maxScore,
    };
    if (form.description.trim()) {
      payload.description = form.description.trim();
    }

    setSaving(true);
    const toastId = toast.loading(editingId ? "Updating band..." : "Creating band...");

    try {
      if (editingId) {
        await adminRequest("/api/admin/grading-scales", {
          method: "PUT",
          body: JSON.stringify({ id: editingId, ...payload }),
          headers: { "Content-Type": "application/json" },
        });
        toast.success("Score band updated", { id: toastId });
      } else {
        await adminPost("/api/admin/grading-scales", payload);
        toast.success("Score band created", { id: toastId });
      }
      resetForm();
      await load({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save score band", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: ScaleRow) => {
    const label = row.description ? `${row.grade} (${row.description})` : row.grade;
    if (!window.confirm(`Delete score band "${label}"?`)) return;

    setSaving(true);
    try {
      await adminDelete(`/api/admin/grading-scales?id=${encodeURIComponent(row.id)}`);
      setScales((current) => current.filter((item) => item.id !== row.id));
      toast.success("Score band deleted");
      if (editingId === row.id) resetForm();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete score band");
      await load({ silent: true });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = async (preset: ScalePreset) => {
    const existingGrades = new Set(scales.map((row) => row.grade.trim().toLowerCase()));
    const missing = preset.bands.filter(
      (band) => !existingGrades.has(band.grade.trim().toLowerCase()),
    );

    if (missing.length === 0) {
      toast.info(`All grades from "${preset.label}" are already configured.`);
      return;
    }

    setApplyingPreset(preset.id);
    const toastId = toast.loading(`Adding ${missing.length} band${missing.length === 1 ? "" : "s"}...`);

    try {
      for (const band of missing) {
        await adminPost("/api/admin/grading-scales", {
          grade: band.grade,
          minScore: band.minScore,
          maxScore: band.maxScore,
          description: band.description,
        });
      }
      await load({ silent: true });
      toast.success(`Added ${missing.length} band${missing.length === 1 ? "" : "s"} from ${preset.label}`, {
        id: toastId,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to apply preset", { id: toastId });
      await load({ silent: true });
    } finally {
      setApplyingPreset(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" aria-hidden />
          <p className="text-sm font-medium text-slate-500">Loading grading scales...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        eyebrow="Assessment"
        title="Grades & Scales"
        description="Define score bands that map percentage marks to grades. Used when recording and reporting student results."
        accent="slate"
        actions={
          <button
            type="button"
            onClick={() => (formOpen ? resetForm() : openCreate())}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            {formOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {formOpen ? "Close" : "Add band"}
          </button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Score bands" value={stats.total} />
        <StatCard label="Coverage (0–100)" value={stats.coverage} suffix="%" />
        <StatCard label="Gaps & overlaps" value={stats.issues} />
      </div>

      <CoverageAlerts coverage={coverage} />

      {scales.length > 0 ? <CoverageBar scales={sortedScales} /> : null}

      <section className={`${messageSurfaceClass} p-5 sm:p-6`}>
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Quick presets</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Add missing bands from a standard scale without removing existing ones.
            </p>
          </div>
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden />
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {GRADING_PRESETS.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              existingGrades={scales.map((row) => row.grade)}
              loading={applyingPreset === preset.id}
              disabled={Boolean(applyingPreset)}
              onApply={() => void applyPreset(preset)}
            />
          ))}
        </div>
      </section>

      {formOpen ? (
        <section className={`${messageSurfaceClass} p-5 sm:p-6`}>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {editingId ? "Edit score band" : "New score band"}
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {editingId
                  ? "Update the grade label, score range, or remarks."
                  : "Map a percentage range to a grade for reports and transcripts."}
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

          <div className="grid gap-4 md:grid-cols-3">
            <label>
              <span className={messageLabelClass}>Grade</span>
              <input
                value={form.grade}
                onChange={(e) => setForm((prev) => ({ ...prev, grade: e.target.value }))}
                placeholder="e.g. 1 or A"
                className={messageFieldClass}
                autoFocus
              />
            </label>
            <label>
              <span className={messageLabelClass}>Min score (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.minScore}
                onChange={(e) => setForm((prev) => ({ ...prev, minScore: e.target.value }))}
                placeholder="0"
                className={messageFieldClass}
              />
            </label>
            <label>
              <span className={messageLabelClass}>Max score (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.maxScore}
                onChange={(e) => setForm((prev) => ({ ...prev, maxScore: e.target.value }))}
                placeholder="100"
                className={messageFieldClass}
              />
            </label>
            <label className="md:col-span-3">
              <span className={messageLabelClass}>Remarks (optional)</span>
              <input
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Distinction, Merit, Credit"
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {editingId ? "Save changes" : "Create band"}
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
        <div className="flex flex-col gap-1 border-b border-slate-100/90 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900">All score bands</h2>
          <p className="text-xs tabular-nums text-slate-500">
            {sortedScales.length} band{sortedScales.length === 1 ? "" : "s"} · sorted by highest min score
          </p>
        </div>

        {sortedScales.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-base font-semibold text-slate-800">No score bands yet</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
              Start with a preset or add bands manually to cover the full 0–100 range.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add band
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedScales.map((row, index) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${bandTone(row.grade, index)}`}
                  >
                    {row.grade}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900">
                      {row.description || row.name || `Grade ${row.grade}`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>
                        <span className="font-medium text-slate-600">Range:</span>{" "}
                        {row.min_score}% – {row.max_score}%
                      </span>
                      <span>
                        <span className="font-medium text-slate-600">Span:</span>{" "}
                        {row.max_score - row.min_score + 1} points
                      </span>
                    </div>
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
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className={`${messageSurfaceClass} px-4 py-3.5`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-slate-900">
        {value}
        {suffix ? <span className="text-lg text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

function CoverageAlerts({
  coverage,
}: {
  coverage: ReturnType<typeof analyzeScaleCoverage>;
}) {
  const { coveragePercent, gaps, overlaps } = coverage;
  const isComplete = coveragePercent === 100 && gaps.length === 0 && overlaps.length === 0;

  if (isComplete) {
    return (
      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/80 px-4 py-3.5 text-sm text-emerald-900">
        <p className="font-semibold">Full coverage</p>
        <p className="mt-0.5 text-emerald-800/90">
          Score bands cover 0–100% with no gaps or overlaps.
        </p>
      </div>
    );
  }

  const messages: string[] = [];
  if (gaps.length > 0) {
    messages.push(
      `Gaps: ${gaps.map((gap) => `${gap.from}–${gap.to}%`).join(", ")}`,
    );
  }
  if (overlaps.length > 0) {
    messages.push(
      `Overlaps: ${overlaps
        .slice(0, 4)
        .map((item) => `${item.a}/${item.b} (${item.from}–${item.to}%)`)
        .join(", ")}${overlaps.length > 4 ? ` +${overlaps.length - 4} more` : ""}`,
    );
  }
  if (coveragePercent < 100 && gaps.length === 0) {
    messages.push(`Only ${coveragePercent}% of the scale is covered.`);
  }

  return (
    <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 px-4 py-3.5 text-sm text-amber-950">
      <p className="font-semibold">Coverage needs attention ({coveragePercent}%)</p>
      <p className="mt-0.5 text-amber-900/90">{messages.join(" · ")}</p>
    </div>
  );
}

function CoverageBar({ scales }: { scales: ScaleRow[] }) {
  return (
    <section className={`${messageSurfaceClass} p-5 sm:p-6`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Visual scale (0–100%)</h2>
          <p className="mt-0.5 text-xs text-slate-500">Band widths reflect configured ranges.</p>
        </div>
      </div>
      <div className="relative h-10 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/90">
        {scales.map((row, index) => {
          const left = row.min_score;
          const width = Math.max(0, row.max_score - row.min_score + 1);
          return (
            <div
              key={row.id}
              className={`absolute top-0 h-full ${bandTone(row.grade, index)} opacity-90`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${row.grade}: ${row.min_score}–${row.max_score}%`}
            />
          );
        })}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold text-white mix-blend-difference">
          <span>0</span>
          <span>50</span>
          <span>100</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {scales.map((row, index) => (
          <span
            key={row.id}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600 ring-1 ring-slate-200/90"
          >
            <span className={`h-2 w-2 rounded-full ${bandTone(row.grade, index)}`} aria-hidden />
            {row.grade}: {row.min_score}–{row.max_score}%
          </span>
        ))}
      </div>
    </section>
  );
}

function PresetCard({
  preset,
  existingGrades,
  loading,
  disabled,
  onApply,
}: {
  preset: ScalePreset;
  existingGrades: string[];
  loading: boolean;
  disabled: boolean;
  onApply: () => void;
}) {
  const existingSet = new Set(existingGrades.map((grade) => grade.trim().toLowerCase()));
  const missingCount = preset.bands.filter(
    (band) => !existingSet.has(band.grade.trim().toLowerCase()),
  ).length;

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">{preset.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{preset.description}</p>
          <p className="mt-2 text-xs text-slate-600">
            {missingCount === 0
              ? "All bands already present"
              : `${missingCount} band${missingCount === 1 ? "" : "s"} to add`}
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || missingCount === 0}
          onClick={onApply}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : null}
          Apply
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {preset.bands.map((band) => {
          const present = existingSet.has(band.grade.trim().toLowerCase());
          return (
            <span
              key={band.grade}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                present
                  ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/90"
                  : "bg-white text-slate-600 ring-1 ring-slate-200/90"
              }`}
            >
              {band.grade} ({band.minScore}–{band.maxScore})
            </span>
          );
        })}
      </div>
    </div>
  );
}