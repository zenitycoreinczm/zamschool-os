"use client";

import { useEffect, useRef, useState } from "react";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { CreditCard, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type FeeRow = {
  id: string;
  studentId: string;
  studentName: string;
  feeName: string;
  feeDescription: string | null;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: string;
  dueDate: string | null;
  billingMonth: string | null;
  createdAt: string;
};

type FeeSummary = {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  overdueCount: number;
  paidCount: number;
  pendingCount: number;
};

const statusColors: Record<string, string> = {
  PAID: "border-emerald-300 bg-emerald-50 text-emerald-700",
  WAIVED: "border-blue-300 bg-blue-50 text-blue-700",
  PENDING: "border-amber-300 bg-amber-50 text-amber-700",
  PARTIAL: "border-orange-300 bg-orange-50 text-orange-700",
  OVERDUE: "border-rose-300 bg-rose-50 text-rose-700",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function ParentFeesPage() {
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const load = async () => {
      const [childrenRes, feesRes] = await Promise.all([
        fetch("/api/parent/children"),
        fetch("/api/parent/fees"),
      ]);

      if (childrenRes.ok) {
        const body = await childrenRes.json();
        setChildren(body.data ?? []);
      }

      if (feesRes.ok) {
        const body = await feesRes.json();
        setFees(body.data?.fees ?? []);
        setSummary(body.data?.summary ?? null);
      } else {
        setError("Failed to load fee information");
      }

      setLoading(false);
    };

    void load();
  }, []);

  const filteredFees = selectedChild
    ? fees.filter((f) => f.studentId === selectedChild)
    : fees;

  if (loading) return <WorkspaceLoader label="Loading fees" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">School Fees</h1>
          <p className="text-sm text-slate-500">
            View fees and payment status for your children
          </p>
        </div>
        {children.length > 1 && (
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">All children</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        )}
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Surface variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-sky-100">
                <CreditCard className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Due</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatCurrency(summary.totalDue)}
                </p>
              </div>
            </div>
          </Surface>
          <Surface variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Paid</p>
                <p className="text-lg font-semibold text-emerald-600">
                  {formatCurrency(summary.totalPaid)}
                </p>
              </div>
            </div>
          </Surface>
          <Surface variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="text-lg font-semibold text-amber-600">
                  {formatCurrency(summary.totalOutstanding)}
                </p>
              </div>
            </div>
          </Surface>
          <Surface variant="elevated" className="p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-rose-100">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Overdue</p>
                <p className="text-lg font-semibold text-rose-600">
                  {summary.overdueCount}
                </p>
              </div>
            </div>
          </Surface>
        </div>
      )}

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        </Surface>
      ) : filteredFees.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <CreditCard className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">No fee records found.</p>
        </Surface>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Child
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Fee
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Paid
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Balance
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Due
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFees.map((fee) => (
                <tr key={fee.id} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {fee.studentName}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {fee.feeName}
                    {fee.billingMonth && (
                      <span className="ml-1 text-xs text-slate-400">
                        ({fee.billingMonth})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatCurrency(fee.amountDue)}
                  </td>
                  <td className="px-4 py-3 text-emerald-600">
                    {formatCurrency(fee.amountPaid)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatCurrency(fee.balance)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {fee.dueDate || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        statusColors[fee.status] ||
                          "border-slate-200 bg-white text-slate-600",
                      )}
                    >
                      {fee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
