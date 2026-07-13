"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminDelete,
  adminGet,
  adminPost,
  buildFinanceMutationPayload,
} from "@/lib/admin-route-client";
import { getClientUser } from "@/lib/supabase-auth-client";
import { normalizeRole } from "@/lib/roles";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";

type FinanceEntry = {
  id: string;
  transaction_type: string;
  category: string | null;
  amount: number | string;
  description: string | null;
  transaction_date: string;
};

type FinanceSummary = {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
};

const EMPTY_SUMMARY: FinanceSummary = {
  totalIncome: 0,
  totalExpense: 0,
  netBalance: 0,
};

export default function AdminFinancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>(EMPTY_SUMMARY);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [form, setForm] = useState({
    type: "income",
    category: "",
    amount: "",
    description: "",
    transaction_date: "",
  });
  const [canWriteFinance, setCanWriteFinance] = useState(false);

  const checkRole = useCallback(async () => {
    try {
      const user = await getClientUser();
      if (!user) return;
      const meta = user.user_metadata?.role || user.app_metadata?.role || "";
      const normalized = normalizeRole(meta);
      setCanWriteFinance(normalized === "BURSAR" || normalized === "SUPER_ADMIN");
    } catch {
      // fall back to read-only
      setCanWriteFinance(false);
    }
  }, []);

  useEffect(() => {
    void checkRole();
  }, [checkRole]);

  async function loadFinance() {
    setLoading(true);
    try {
      const response = await adminGet("/api/admin/finance");
      setRows(Array.isArray(response?.data) ? response.data : []);
      setSummary(response?.summary || EMPTY_SUMMARY);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load finance ledger");
      setRows([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFinance();
  }, []);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const type = String(row.transaction_type || "").toLowerCase();
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        String(row.category || "").toLowerCase().includes(q) ||
        String(row.description || "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, typeFilter]);

  const addEntry = async () => {
    if (!form.category.trim() || !form.amount) {
      toast.error("Category and amount are required");
      return;
    }

    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }

    setSaving(true);
    const t = toast.loading("Adding finance entry...");
    try {
      await adminPost("/api/admin/finance", buildFinanceMutationPayload(form));
      setForm({ type: "income", category: "", amount: "", description: "", transaction_date: "" });
      await loadFinance();
      toast.success("Entry added", { id: t });
    } catch (err: any) {
      toast.error(err?.message || "Failed to add entry", { id: t });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm("Delete this finance entry?")) return;
    const t = toast.loading("Deleting entry...");
    try {
      await adminDelete("/api/admin/finance", { params: { id } });
      await loadFinance();
      toast.success("Entry deleted", { id: t });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete entry", { id: t });
    }
  };

  const exportCsv = () => {
    const headers = ["type", "category", "amount", "description", "date"];
    const lines = [headers.join(",")];

    for (const row of visibleRows) {
      lines.push(
        [
          String(row.transaction_type || ""),
          escapeCsv(String(row.category || "")),
          String(row.amount || "0"),
          escapeCsv(String(row.description || "")),
          String(row.transaction_date || ""),
        ].join(",")
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "finance-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <span>Loading finance module...</span>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Finance Ledger</h1>
        <p className="text-slate-500 mt-1">Track income, expenses, and net school position.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card label="Income" value={`ZMW ${summary.totalIncome.toLocaleString()}`} />
        <Card label="Expenses" value={`ZMW ${summary.totalExpense.toLocaleString()}`} />
        <Card label="Net" value={`ZMW ${summary.netBalance.toLocaleString()}`} />
      </div>

      {canWriteFinance ? (
        <Surface variant="default" className="space-y-3 p-4" as="div">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="grid md:grid-cols-2 gap-3">
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
              <input
                value={form.category}
                onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                type="number"
                placeholder="Amount"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <DateOnlyPicker
              value={form.transaction_date}
              onChange={(date) => setForm((p) => ({ ...p, transaction_date: date }))}
              label="Transaction date"
              accent="slate"
            />
          </div>
          <button
            type="button"
            onClick={addEntry}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add Entry
          </button>
        </Surface>
      ) : null}

      <Surface variant="default" className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between" as="div">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 min-w-[280px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search category or description"
            className="w-full text-sm outline-none"
          />
        </div>

        <div className="flex items-center gap-2" role="group" aria-label="Filter by type">
          {(["all", "income", "expense"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              aria-pressed={typeFilter === t}
              className={cn(
                "rounded-lg px-3 py-2 text-xs font-medium capitalize transition",
                typeFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </Surface>

      <Surface variant="default" className="overflow-x-auto p-0" as="div">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Category</th>
              <th className="text-left px-3 py-2">Amount</th>
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2">Date</th>
              {canWriteFinance ? <th className="text-left px-3 py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={canWriteFinance ? 6 : 5} className="px-3 py-4 text-slate-500">
                  No entries found.
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-3 capitalize text-slate-700">{String(row.transaction_type || "-")}</td>
                  <td className="px-3 py-3 text-slate-700">{String(row.category || "-")}</td>
                  <td className="px-3 py-3 text-slate-700">{Number(row.amount || 0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-slate-600">{String(row.description || "-")}</td>
                  <td className="px-3 py-3 text-slate-600">{String(row.transaction_date || "-")}</td>
                  {canWriteFinance ? (
                    <td className="px-3 py-3">
                      <button
                        onClick={() => deleteEntry(row.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center hover:bg-red-100"
                        aria-label={`Delete entry ${row.description || row.category || row.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Surface>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <Surface variant="default" className="p-4" as="div">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Surface>
  );
}

function escapeCsv(value: string) {
  const v = value.replace(/"/g, '""');
  return `"${v}"`;
}
