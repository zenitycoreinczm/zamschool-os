"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { getDisplayName } from "@/lib/profile-utils";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  actor: string;
  summary: string;
  timestamp: string;
};

export default function AdminAuditPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | "create" | "update" | "delete">("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const body = await adminApiJson<{ data?: any[] }>("/api/admin/audit?limit=250");
        setRows(
          (body.data || []).map((row) => ({
            id: String(row.id),
            action: String(row.action || row.event || row.event_type || "update").toLowerCase(),
            entity: String(row.entity_type || row.resource || row.module || "record"),
            actor: getDisplayName(row.profiles) || row.user_id || "System",
            summary: String(row.summary || row.description || row.metadata?.summary || ""),
            timestamp: String(row.created_at || row.timestamp || row.occurred_at || ""),
          }))
        );
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to load audit logs");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (!query.trim()) return true;
      const q = query.trim().toLowerCase();
      return `${row.actor} ${row.entity} ${row.action} ${row.summary}`.toLowerCase().includes(q);
    });
  }, [actionFilter, query, rows]);

  const metrics = useMemo(() => ({
    total: rows.length,
    create: rows.filter((row) => row.action === "create").length,
    update: rows.filter((row) => row.action === "update").length,
    delete: rows.filter((row) => row.action === "delete").length,
  }), [rows]);

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
        <span>Loading audit logs...</span>
      </Surface>
    );
  }

  return (
    <div className="space-y-6">
      <Surface variant="default" className="rounded-[28px] p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600">Oversight</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">Audit Trail</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Track who changed what, when it happened, and which records were touched across the admin workspace.</p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Metric label="Entries" value={String(metrics.total)} />
              <Metric label="Creates" value={String(metrics.create)} />
              <Metric label="Updates" value={String(metrics.update)} />
              <Metric label="Deletes" value={String(metrics.delete)} />
            </div>
          </div>

          <div className="w-full rounded-[24px] border border-workspace-border bg-slate-50 p-4 xl:max-w-xl">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Search trail</span>
              <div className="flex items-center gap-2 rounded-2xl border border-workspace-border bg-white px-4 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search actor, entity, action, or summary"
                  className="w-full bg-transparent text-sm text-slate-700 outline-none"
                />
              </div>
            </label>

            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by action">
              {(["all", "create", "update", "delete"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActionFilter(item)}
                  aria-pressed={actionFilter === item}
                  className={cn(
                    "rounded-full px-3 py-2 text-xs font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
                    actionFilter === item
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Surface>

      <Surface variant="default" className="rounded-[28px] overflow-hidden">
        <div className="border-b border-workspace-border px-5 py-4 md:px-6">
          <div className="text-lg font-semibold text-slate-900">Change log</div>
          <p className="mt-1 text-sm text-slate-500">Filtered results update immediately as you search or focus a specific action type.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 text-left">Action</th>
                <th scope="col" className="px-4 py-3 text-left">Entity</th>
                <th scope="col" className="px-4 py-3 text-left">Actor</th>
                <th scope="col" className="px-4 py-3 text-left">Summary</th>
                <th scope="col" className="px-4 py-3 text-left">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">No audit logs match this view.</td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                        row.action === "create"
                          ? "bg-emerald-100 text-emerald-700"
                          : row.action === "delete"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      )}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.entity}</td>
                    <td className="px-4 py-3 text-slate-700">{row.actor}</td>
                    <td className="px-4 py-3 text-slate-500">{row.summary || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{formatTs(row.timestamp)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-workspace-border bg-slate-50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function formatTs(value: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}
