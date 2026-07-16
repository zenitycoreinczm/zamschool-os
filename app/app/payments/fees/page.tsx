"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search, Check, X } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";

type FeeRow = {
  id: string;
  student_id: string | null;
  amount: number;
  reference_number: string | null;
  status: string;
  payment_type: string | null;
  student?: { first_name?: string; last_name?: string; admission_number?: string } | null;
};

export default function AppPaymentFeesPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApiJson("/api/payments/fees");
      setRows(data?.data || data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load fees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let result = rows;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((r) => {
        const name = [r.student?.first_name, r.student?.last_name].join(" ").toLowerCase();
        return name.includes(q) || (r.reference_number || "").toLowerCase().includes(q);
      });
    }
    return result;
  }, [rows, query, statusFilter]);

  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">Fee Management</h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="outline-none" />
          </div>
          <div className="flex gap-1">
            {(["all", "pending", "confirmed", "rejected"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-lg px-3 py-1.5 text-sm ${statusFilter === s ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {loading && <Loader2 className="animate-spin text-gray-400" size={20} />}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{row.student ? `${row.student.first_name} ${row.student.last_name}` : "-"}</td>
                  <td className="px-4 py-3 font-medium">K{row.amount}</td>
                  <td className="px-4 py-3">{row.reference_number || "-"}</td>
                  <td className="px-4 py-3">{row.payment_type || "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${row.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : row.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
