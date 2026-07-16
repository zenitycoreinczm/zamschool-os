"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";

type StudentPaymentRow = {
  id: string;
  profile_id: string;
  first_name?: string;
  last_name?: string;
  admission_number?: string;
  class_id?: string;
  total_paid?: number;
  outstanding?: number;
  last_payment_date?: string;
};

export default function AppPaymentStudentsPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StudentPaymentRow[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const nextQuery = (searchParams.get("q") || "").trim();
    if (nextQuery) {
      setQuery(nextQuery);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminApiJson("/api/payments/students");
      setRows(data?.data || data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load student accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!query) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => {
      const name = [r.first_name, r.last_name].join(" ").toLowerCase();
      return name.includes(q) || (r.admission_number || "").toLowerCase().includes(q);
    });
  }, [rows, query]);

  return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-2xl font-bold">Student Accounts</h1>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
            <Search size={16} className="text-gray-400" />
            <input placeholder="Search students..." value={query} onChange={(e) => setQuery(e.target.value)} className="outline-none" />
          </div>
          {loading && <Loader2 className="animate-spin text-gray-400" size={20} />}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Admission #</th>
                <th className="px-4 py-3 font-medium">Total Paid</th>
                <th className="px-4 py-3 font-medium">Outstanding</th>
                <th className="px-4 py-3 font-medium">Last Payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{row.first_name} {row.last_name}</td>
                  <td className="px-4 py-3">{row.admission_number || "-"}</td>
                  <td className="px-4 py-3 text-emerald-600">K{(row.total_paid || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-amber-600">K{(row.outstanding || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.last_payment_date || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}
