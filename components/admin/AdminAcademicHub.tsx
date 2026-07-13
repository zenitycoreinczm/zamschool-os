"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import { adminApiJson } from "@/lib/admin-browser-api";

type YearRow = Record<string, any>;
type TermRow = Record<string, any>;

export function AdminAcademicHub() {
  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(false);
  const [savingTerm, setSavingTerm] = useState(false);

  const [years, setYears] = useState<YearRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);

  const [newYear, setNewYear] = useState({ name: "", start_date: "", end_date: "" });
  const [newTerm, setNewTerm] = useState({ name: "", start_date: "", end_date: "", academic_year_id: "" });

  const yearNameKey = useMemo(() => inferKey(years, ["name", "title", "label", "year_name"], "name"), [years]);
  const yearStartKey = useMemo(() => inferKey(years, ["start_date", "starts_at", "start"], "start_date"), [years]);
  const yearEndKey = useMemo(() => inferKey(years, ["end_date", "ends_at", "end"], "end_date"), [years]);
  const yearActiveKey = useMemo(() => inferKey(years, ["is_active", "active", "is_current"], "is_active"), [years]);

  const termNameKey = useMemo(() => inferKey(terms, ["name", "title", "label", "term_name"], "name"), [terms]);
  const termStartKey = useMemo(() => inferKey(terms, ["start_date", "starts_at", "start"], "start_date"), [terms]);
  const termEndKey = useMemo(() => inferKey(terms, ["end_date", "ends_at", "end"], "end_date"), [terms]);
  const termActiveKey = useMemo(() => inferKey(terms, ["is_active", "active", "is_current"], "is_active"), [terms]);
  const termYearKey = useMemo(
    () => inferKey(terms, ["academic_year_id", "year_id", "academicYearId"], "academic_year_id"),
    [terms]
  );

  const activeYear = useMemo(
    () => years.find((row) => Boolean(row[yearActiveKey])) || years[0] || null,
    [years, yearActiveKey]
  );
  const activeTerm = useMemo(
    () => terms.find((row) => Boolean(row[termActiveKey])) || terms[0] || null,
    [terms, termActiveKey]
  );

  const termsByYear = useMemo(() => {
    const map = new Map<string, TermRow[]>();
    for (const term of terms) {
      const yearId = String(term[termYearKey] || "");
      if (!yearId) continue;
      const bucket = map.get(yearId) || [];
      bucket.push(term);
      map.set(yearId, bucket);
    }
    return map;
  }, [terms, termYearKey]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadData();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to initialize academic module");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadData = async () => {
    const [yearsBody, termsBody] = await Promise.all([
      adminApiJson<{ data?: YearRow[] }>("/api/admin/academic-years"),
      adminApiJson<{ data?: TermRow[] }>("/api/admin/terms"),
    ]);

    const yearsFiltered = yearsBody.data || [];
    const termsFiltered = termsBody.data || [];

    setYears(yearsFiltered);
    setTerms(termsFiltered);

    if (yearsFiltered.length > 0) {
      setNewTerm((prev) => ({
        ...prev,
        academic_year_id: prev.academic_year_id || String(yearsFiltered[0].id),
      }));
    }
  };

  const addYear = async () => {
    if (!newYear.name.trim() || !newYear.start_date || !newYear.end_date) {
      toast.error("Year name, start date, and end date are required");
      return;
    }

    setSavingYear(true);
    const t = toast.loading("Creating academic year...");
    try {
      await adminApiJson("/api/admin/academic-years", {
        method: "POST",
        body: JSON.stringify({
          name: newYear.name.trim(),
          startDate: newYear.start_date,
          endDate: newYear.end_date,
          isActive: false,
        }),
      });

      setNewYear({ name: "", start_date: "", end_date: "" });
      await loadData();
      toast.success("Academic year created", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create year", { id: t });
    } finally {
      setSavingYear(false);
    }
  };

  const addTerm = async () => {
    if (!newTerm.name.trim() || !newTerm.start_date || !newTerm.end_date || !newTerm.academic_year_id) {
      toast.error("Term name, dates, and linked year are required");
      return;
    }

    setSavingTerm(true);
    const t = toast.loading("Creating term...");
    try {
      await adminApiJson("/api/admin/terms", {
        method: "POST",
        body: JSON.stringify({
          name: newTerm.name.trim(),
          startDate: newTerm.start_date,
          endDate: newTerm.end_date,
          academicYearId: newTerm.academic_year_id,
          isActive: false,
        }),
      });

      setNewTerm((prev) => ({ ...prev, name: "", start_date: "", end_date: "" }));
      await loadData();
      toast.success("Term created", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create term", { id: t });
    } finally {
      setSavingTerm(false);
    }
  };

  const setActiveYear = async (id: string) => {
    if (!yearActiveKey) return;
    const t = toast.loading("Updating active year...");
    try {
      await adminApiJson("/api/admin/academic-years", {
        method: "PUT",
        body: JSON.stringify({ id, isActive: true }),
      });
      await loadData();
      toast.success("Active year updated", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update active year", { id: t });
    }
  };

  const setActiveTerm = async (id: string) => {
    if (!termActiveKey) return;
    const t = toast.loading("Updating active term...");
    try {
      await adminApiJson("/api/admin/terms", {
        method: "PUT",
        body: JSON.stringify({ id, isActive: true }),
      });
      await loadData();
      toast.success("Active term updated", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update active term", { id: t });
    }
  };

  const deleteYear = async (id: string) => {
    const t = toast.loading("Deleting year...");
    try {
      await adminApiJson(`/api/admin/academic-years?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await loadData();
      toast.success("Year deleted", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete year", { id: t });
    }
  };

  const deleteTerm = async (id: string) => {
    const t = toast.loading("Deleting term...");
    try {
      await adminApiJson(`/api/admin/terms?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await loadData();
      toast.success("Term deleted", { id: t });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete term", { id: t });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        <span className="text-sm text-slate-500">Loading academic calendar...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHero
        eyebrow="Academic structure"
        title="Academic years & terms"
        description="Define the school calendar, activate the current year and term, and keep timetables, attendance, and results aligned to the right session."
        stats={[
          {
            label: "Academic years",
            value: years.length,
            hint: activeYear ? `Active: ${String(activeYear[yearNameKey] || "—")}` : "None active",
            tone: "sky",
          },
          {
            label: "Terms",
            value: terms.length,
            hint: activeTerm ? `Active: ${String(activeTerm[termNameKey] || "—")}` : "None active",
            tone: "violet",
          },
          {
            label: "Terms this year",
            value: activeYear ? (termsByYear.get(String(activeYear.id))?.length ?? 0) : 0,
            hint: "Under active year",
            tone: "amber",
          },
          {
            label: "Calendar status",
            value: activeYear && activeTerm ? "Ready" : "Setup",
            hint: activeYear && activeTerm ? "Year + term set" : "Activate year & term",
            tone: activeYear && activeTerm ? "emerald" : "slate",
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Academic years</h2>
              <p className="text-xs text-slate-500">Multi-year planning and session boundaries</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {years.length} total
            </span>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Year name" value={newYear.name} onChange={(v) => setNewYear((p) => ({ ...p, name: v }))} />
              <DateOnlyPicker
                label="Starts"
                value={newYear.start_date}
                onChange={(v) => setNewYear((p) => ({ ...p, start_date: v }))}
                accent="slate"
                placeholder="Start date"
              />
              <DateOnlyPicker
                label="Ends"
                value={newYear.end_date}
                onChange={(v) => setNewYear((p) => ({ ...p, end_date: v }))}
                accent="slate"
                placeholder="End date"
                minDate={newYear.start_date || undefined}
              />
            </div>
            <button
              type="button"
              onClick={() => void addYear()}
              disabled={savingYear}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingYear ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add academic year
            </button>

            <div className="space-y-2">
              {years.length === 0 ? <EmptyRow label="No academic years yet — add your first year above." /> : null}
              {years.map((year) => {
                const isActive = Boolean(year[yearActiveKey]);
                const yearTerms = termsByYear.get(String(year.id)) || [];
                return (
                  <article
                    key={year.id}
                    className={`rounded-xl border px-4 py-3 ${isActive ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-slate-50/50"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{String(year[yearNameKey] || "Unnamed year")}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateLabel(year[yearStartKey])} → {formatDateLabel(year[yearEndKey])}
                        </p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {yearTerms.length} term{yearTerms.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {yearActiveKey ? (
                          <button
                            type="button"
                            onClick={() => void setActiveYear(year.id)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                              isActive ? "bg-emerald-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {isActive ? "Active year" : "Set active"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void deleteYear(year.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          aria-label="Delete year"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Terms</h2>
              <p className="text-xs text-slate-500">Terms belong to an academic year</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {terms.length} total
            </span>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Term name" value={newTerm.name} onChange={(v) => setNewTerm((p) => ({ ...p, name: v }))} />
              <DateOnlyPicker
                label="Starts"
                value={newTerm.start_date}
                onChange={(v) => setNewTerm((p) => ({ ...p, start_date: v }))}
                accent="slate"
                placeholder="Start date"
              />
              <DateOnlyPicker
                label="Ends"
                value={newTerm.end_date}
                onChange={(v) => setNewTerm((p) => ({ ...p, end_date: v }))}
                accent="slate"
                placeholder="End date"
                minDate={newTerm.start_date || undefined}
              />
              <label>
                <span className="mb-1 block text-xs font-medium text-slate-600">Academic year</span>
                <select
                  value={newTerm.academic_year_id}
                  onChange={(e) => setNewTerm((p) => ({ ...p, academic_year_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                >
                  {years.length === 0 ? <option value="">Add a year first</option> : null}
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {String(year[yearNameKey] || year.id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => void addTerm()}
              disabled={savingTerm || years.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {savingTerm ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add term
            </button>

            <div className="space-y-2">
              {terms.length === 0 ? <EmptyRow label="No terms yet — link each term to an academic year." /> : null}
              {terms.map((term) => {
                const isActive = Boolean(term[termActiveKey]);
                const parentYear = years.find((year) => String(year.id) === String(term[termYearKey]));
                return (
                  <article
                    key={term.id}
                    className={`rounded-xl border px-4 py-3 ${isActive ? "border-violet-200 bg-violet-50/50" : "border-slate-100 bg-slate-50/50"}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{String(term[termNameKey] || "Unnamed term")}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateLabel(term[termStartKey])} → {formatDateLabel(term[termEndKey])}
                        </p>
                        {parentYear ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Year: {String(parentYear[yearNameKey] || parentYear.id)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {termActiveKey ? (
                          <button
                            type="button"
                            onClick={() => void setActiveTerm(term.id)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                              isActive ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {isActive ? "Active term" : "Set active"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void deleteTerm(term.id)}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                          aria-label="Delete term"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function formatDateLabel(value: unknown) {
  if (!value) return "—";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function inferKey(rows: Record<string, any>[], candidates: string[], fallback: string) {
  const sample = rows[0] || {};
  for (const candidate of candidates) {
    if (candidate in sample) return candidate;
  }
  return fallback;
}