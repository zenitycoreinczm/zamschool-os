"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  Filter,
  Layers,
  Loader2,
  Plus,
  Receipt,
  Search,
  Smartphone,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatKwacha } from "@/lib/zambia-localization";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import {
  FeeReceiptModal,
  type FeeReceiptData,
} from "@/components/payments/FeeReceiptModal";
import {
  RecordPaymentModal,
  type StudentOption,
} from "@/components/payments/RecordPaymentModal";

type PaymentRow = {
  id: string;
  student_id: string | null;
  amount: number;
  reference_number: string | null;
  status: string;
  payment_type: string | null;
  payment_method: string | null;
  paid_at: string | null;
  created_at: string;
  student?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    admission_number?: string | null;
    class_name?: string | null;
  } | null;
};

type FeeDefinition = {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  frequency: string;
  is_active: boolean;
};

type TabType = "payments" | "arrears" | "fee_structures";

export default function AppPaymentFeesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("payments");
  const [loading, setLoading] = useState(true);

  // Data states
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [fees, setFees] = useState<FeeDefinition[]>([]);
  const [summary, setSummary] = useState({
    totalCollected: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    totalStudents: 0,
  });

  // Filter states
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("all");
  const [arrearsFilter, setArrearsFilter] = useState<"all" | "debtors" | "cleared">("debtors");

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [preselectedStudentId, setPreselectedStudentId] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<FeeReceiptData | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [paymentsRes, studentsRes, summaryRes, feesRes] = await Promise.allSettled([
        adminApiJson<{ data?: PaymentRow[] }>("/api/admin/payments"),
        adminApiJson<{ data?: StudentOption[]; summary?: any }>("/api/payments/students"),
        adminApiJson<{
          total_collected?: number;
          total_outstanding?: number;
          overdue_count?: number;
          student_count?: number;
        }>("/api/payments/billing/summary"),
        adminApiJson<{ data?: FeeDefinition[] }>("/api/payments/fees"),
      ]);

      if (paymentsRes.status === "fulfilled" && paymentsRes.value?.data) {
        const rows = (paymentsRes.value.data || []).map((row: any) => ({
          ...row,
          status: (row.status || "PENDING").toLowerCase(),
          student: row.profiles || row.student || null,
        }));
        setPayments(rows);
      }

      if (studentsRes.status === "fulfilled" && studentsRes.value?.data) {
        setStudents(studentsRes.value.data || []);
      }

      if (summaryRes.status === "fulfilled" && summaryRes.value) {
        setSummary({
          totalCollected: summaryRes.value.total_collected || 0,
          totalOutstanding: summaryRes.value.total_outstanding || 0,
          overdueCount: summaryRes.value.overdue_count || 0,
          totalStudents: summaryRes.value.student_count || 0,
        });
      }

      if (feesRes.status === "fulfilled" && feesRes.value?.data) {
        setFees(feesRes.value.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load fee management data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updatePaymentStatus = async (id: string, nextStatus: "confirmed" | "rejected") => {
    setActionLoadingId(id);
    const toastId = toast.loading(nextStatus === "confirmed" ? "Confirming payment…" : "Rejecting payment…");
    try {
      await adminApiJson(`/api/admin/payments?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ id, status: nextStatus.toUpperCase() }),
      });
      toast.success(`Payment marked as ${nextStatus}`, { id: toastId });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${nextStatus} payment`, { id: toastId });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReceiptForPayment = (payment: PaymentRow) => {
    const studentName = payment.student
      ? `${payment.student.first_name || ""} ${payment.student.last_name || ""}`.trim()
      : "Student";
    const receiptNo = payment.reference_number || `RCP-${payment.id.slice(0, 8).toUpperCase()}`;

    setReceiptData({
      receiptNumber: receiptNo,
      studentName: studentName || "Student",
      admissionNumber: payment.student?.admission_number || null,
      className: payment.student?.class_name || null,
      amountPaid: Number(payment.amount) || 0,
      paymentMethod: payment.payment_method || "Cash",
      referenceNumber: payment.reference_number || null,
      paidAt: payment.paid_at || payment.created_at,
      feeDescription: formatPaymentType(payment.payment_type),
      status: payment.status.toUpperCase(),
    });
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    let result = payments;
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((p) => {
        const studentName = [p.student?.first_name, p.student?.last_name].join(" ").toLowerCase();
        const adm = (p.student?.admission_number || "").toLowerCase();
        const ref = (p.reference_number || "").toLowerCase();
        return studentName.includes(q) || adm.includes(q) || ref.includes(q);
      });
    }
    return result;
  }, [payments, statusFilter, query]);

  // Filtered Debtors / Students
  const filteredStudents = useMemo(() => {
    let result = students;
    if (arrearsFilter === "debtors") {
      result = result.filter((s) => (s.pending_amount || 0) > 0);
    } else if (arrearsFilter === "cleared") {
      result = result.filter((s) => (s.pending_amount || 0) === 0);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter((s) => {
        const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
        const adm = (s.admission_number || "").toLowerCase();
        return name.includes(q) || adm.includes(q);
      });
    }
    return result;
  }, [students, arrearsFilter, query]);

  const pendingPaymentsCount = useMemo(
    () => payments.filter((p) => p.status === "pending").length,
    [payments]
  );

  const totalDebtorsCount = useMemo(
    () => students.filter((s) => (s.pending_amount || 0) > 0).length,
    [students]
  );

  const heroStats = [
    {
      label: "Total Collected",
      value: formatKwacha(summary.totalCollected, { symbol: "K" }),
      hint: "Current school term",
      tone: "emerald" as const,
    },
    {
      label: "Outstanding Arrears",
      value: formatKwacha(summary.totalOutstanding, { symbol: "K" }),
      hint: `${totalDebtorsCount} students with arrears`,
      tone: summary.totalOutstanding > 0 ? ("amber" as const) : ("slate" as const),
    },
    {
      label: "Pending Approvals",
      value: pendingPaymentsCount,
      hint: pendingPaymentsCount > 0 ? "Requires bursar review" : "All cleared",
      tone: pendingPaymentsCount > 0 ? ("amber" as const) : ("slate" as const),
    },
    {
      label: "Fee Structures",
      value: fees.length,
      hint: `${fees.filter((f) => f.is_active).length} active items`,
      tone: "slate" as const,
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Hero Header */}
      <AdminPageHero
        eyebrow="Finance & Bursar"
        title="Fee Collection & Arrears"
        description="Record cash and mobile money payments, reconcile balances, monitor arrears by student, and generate official school receipts."
        stats={heroStats}
        accent="sky"
        actions={
          <button
            type="button"
            onClick={() => {
              setPreselectedStudentId(null);
              setRecordModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Record Payment
          </button>
        }
      />

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition",
              activeTab === "payments"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Receipt className="h-4 w-4 text-sky-600" />
            Payment Ledger
            {pendingPaymentsCount > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                {pendingPaymentsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("arrears")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition",
              activeTab === "arrears"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <AlertCircle className="h-4 w-4 text-amber-600" />
            Student Arrears
            {totalDebtorsCount > 0 && (
              <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-800">
                {totalDebtorsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("fee_structures")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition",
              activeTab === "fee_structures"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers className="h-4 w-4 text-slate-500" />
            Fee Schedule
          </button>
        </div>

        {/* Global Search */}
        {activeTab !== "fee_structures" && (
          <div className="relative min-w-[260px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeTab === "payments" ? "Search student, ref #..." : "Search student or adm #..."}
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Payment Ledger */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {(["all", "pending", "confirmed", "rejected"] as const).map((s) => {
                const isSelected = statusFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition capitalize",
                      isSelected
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                    )}
                  >
                    {s === "all" ? "All Payments" : s}
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-900">{filteredPayments.length}</strong> transactions
            </span>
          </div>

          {loading ? (
            <Surface variant="dashed" className="flex min-h-48 items-center justify-center gap-3 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              Loading financial transactions…
            </Surface>
          ) : filteredPayments.length === 0 ? (
            <Surface variant="dashed" className="py-16 text-center">
              <CreditCard className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">No payment records found</h3>
              <p className="mt-1 text-xs text-slate-500">
                {query ? "Try adjusting your search criteria or status filter." : "Record the first fee deposit using the button above."}
              </p>
              {!query && (
                <button
                  type="button"
                  onClick={() => setRecordModalOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Record Payment
                </button>
              )}
            </Surface>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((row) => {
                    const studentName = row.student
                      ? `${row.student.first_name || ""} ${row.student.last_name || ""}`.trim()
                      : "Direct Deposit";
                    const isRowActionLoading = actionLoadingId === row.id;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 text-sm">{studentName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {row.student?.admission_number || "No Adm #"}
                            {row.student?.class_name ? ` • ${row.student.class_name}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {formatKwacha(Number(row.amount), { symbol: "K" })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            {renderMethodIcon(row.payment_method)}
                            {formatMethodLabel(row.payment_method)}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 font-medium">
                          {row.reference_number || "-"}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {row.paid_at || row.created_at
                            ? new Date(row.paid_at || row.created_at).toLocaleDateString("en-ZM", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize",
                              row.status === "confirmed"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : row.status === "pending"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={isRowActionLoading}
                                  onClick={() => void updatePaymentStatus(row.id, "confirmed")}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer border border-emerald-200"
                                  title="Confirm Payment"
                                >
                                  {isRowActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  disabled={isRowActionLoading}
                                  onClick={() => void updatePaymentStatus(row.id, "rejected")}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 font-semibold text-rose-700 hover:bg-rose-100 transition cursor-pointer border border-rose-200"
                                  title="Reject Payment"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleOpenReceiptForPayment(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
                            >
                              <Receipt className="h-3.5 w-3.5 text-slate-500" />
                              Receipt
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Arrears & Student Balances */}
      {activeTab === "arrears" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {[
                { id: "debtors" as const, label: "Students with Arrears" },
                { id: "all" as const, label: "All Students" },
                { id: "cleared" as const, label: "Fully Cleared" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setArrearsFilter(opt.id)}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                    arrearsFilter === opt.id
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">
              Showing <strong className="text-slate-900">{filteredStudents.length}</strong> student ledgers
            </span>
          </div>

          {loading ? (
            <Surface variant="dashed" className="flex min-h-48 items-center justify-center gap-3 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              Loading student balances…
            </Surface>
          ) : filteredStudents.length === 0 ? (
            <Surface variant="dashed" className="py-16 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">
                {arrearsFilter === "debtors" ? "No outstanding student arrears!" : "No student records found"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {arrearsFilter === "debtors"
                  ? "All enrolled students have cleared their school fee obligations."
                  : "Try searching with a different name or admission number."}
              </p>
            </Surface>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student Particulars</th>
                    <th className="py-3 px-4">Total Billed</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Outstanding Arrears</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((s) => {
                    const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Student";
                    const pending = s.pending_amount || 0;
                    const paid = s.paid_amount || 0;
                    const total = s.total_amount || pending + paid;
                    const isCleared = pending === 0;

                    return (
                      <tr key={s.student_id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 text-sm">{fullName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {s.admission_number || "No Adm #"}
                            {s.class_name ? ` • ${s.class_name}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {formatKwacha(total, { symbol: "K" })}
                        </td>
                        <td className="py-3 px-4 text-emerald-700 font-semibold">
                          {formatKwacha(paid, { symbol: "K" })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "font-extrabold text-sm",
                              pending > 0 ? "text-amber-800" : "text-slate-400"
                            )}
                          >
                            {formatKwacha(pending, { symbol: "K" })}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                              isCleared
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-800 border border-amber-200"
                            )}
                          >
                            {isCleared ? "Cleared" : "Owing"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setPreselectedStudentId(s.student_id);
                              setRecordModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-bold text-slate-800 hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer shadow-2xs"
                          >
                            <CreditCard className="h-3.5 w-3.5 text-sky-600" />
                            Record Deposit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Fee Schedule & Billing Setup */}
      {activeTab === "fee_structures" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Configured School Fee Structures</h3>
              <p className="text-xs text-slate-500">Official fees billed to students across academic terms.</p>
            </div>
          </div>

          {fees.length === 0 ? (
            <Surface variant="dashed" className="py-16 text-center">
              <Layers className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-900">No fee items configured</h3>
              <p className="mt-1 text-xs text-slate-500">
                Fee schedules can be initialized under school setup settings.
              </p>
            </Surface>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fees.map((fee) => (
                <Surface key={fee.id} variant="elevated" className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{fee.name}</h4>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          fee.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {fee.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {fee.description ? (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{fee.description}</p>
                    ) : null}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Frequency</p>
                      <p className="text-xs font-bold text-slate-700 capitalize">{fee.frequency || "Per Term"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-semibold text-slate-400">Amount</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {formatKwacha(Number(fee.amount), { symbol: "K" })}
                      </p>
                    </div>
                  </div>
                </Surface>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      <RecordPaymentModal
        isOpen={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        studentsList={students}
        preselectedStudentId={preselectedStudentId}
        onPaymentRecorded={(receipt) => {
          setReceiptData(receipt);
          void loadData();
        }}
      />

      {/* Printable Fee Receipt Modal */}
      <FeeReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        receipt={receiptData}
      />
    </div>
  );
}

function formatPaymentType(type?: string | null): string {
  if (!type) return "School Fee Payment";
  const t = type.toLowerCase();
  if (t === "tuition") return "Term Tuition Fee";
  if (t === "pta_levy") return "PTA Levy";
  if (t === "exam_fee") return "ECZ Exam Fee";
  if (t === "uniform") return "Uniform / Books";
  if (t === "boarding") return "Boarding Fee";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatMethodLabel(method?: string | null): string {
  if (!method) return "Cash";
  const m = method.toLowerCase();
  if (m.includes("airtel")) return "Airtel Money";
  if (m.includes("mtn")) return "MTN MoMo";
  if (m.includes("zamtel")) return "Zamtel Kwacha";
  if (m.includes("bank") || m.includes("transfer")) return "Bank Wire";
  if (m.includes("cheque") || m.includes("check")) return "Cheque";
  if (m.includes("cash")) return "Cash";
  return method.toUpperCase();
}

function renderMethodIcon(method?: string | null) {
  if (!method) return <Banknote className="h-3 w-3 text-slate-500" />;
  const m = method.toLowerCase();
  if (m.includes("airtel") || m.includes("mtn") || m.includes("zamtel") || m.includes("momo")) {
    return <Smartphone className="h-3 w-3 text-sky-600" />;
  }
  if (m.includes("bank") || m.includes("wire") || m.includes("card")) {
    return <CreditCard className="h-3 w-3 text-indigo-600" />;
  }
  return <Banknote className="h-3 w-3 text-emerald-600" />;
}
