"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  FileText,
  Loader2,
  Search,
  Smartphone,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatKwacha } from "@/lib/zambia-localization";
import type { FeeReceiptData } from "./FeeReceiptModal";

export type StudentOption = {
  student_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  admission_number?: string | null;
  class_name?: string | null;
  pending_amount?: number;
  total_amount?: number;
  paid_amount?: number;
};

type RecordPaymentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onPaymentRecorded: (receipt: FeeReceiptData) => void;
  studentsList?: StudentOption[];
  schoolName?: string;
  preselectedStudentId?: string | null;
};

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: Banknote, note: "Cash counter deposit" },
  { id: "airtel_money", label: "Airtel Money", icon: Smartphone, note: "Mobile Money (097/077)" },
  { id: "mtn_momo", label: "MTN MoMo", icon: Smartphone, note: "Mobile Money (096/076)" },
  { id: "zamtel", label: "Zamtel Kwacha", icon: Smartphone, note: "Mobile Money (095/075)" },
  { id: "bank_transfer", label: "Bank Transfer", icon: CreditCard, note: "Direct deposit / Wire" },
  { id: "cheque", label: "Cheque", icon: FileText, note: "Bank cheque clearance" },
] as const;

const PAYMENT_TYPES = [
  { id: "tuition", label: "Tuition / Term Fee" },
  { id: "pta_levy", label: "PTA Levy" },
  { id: "exam_fee", label: "ECZ Exam Fee" },
  { id: "uniform", label: "Uniform / Books" },
  { id: "boarding", label: "Boarding Fee" },
  { id: "other", label: "Other School Fee" },
] as const;

export function RecordPaymentModal({
  isOpen,
  onClose,
  onPaymentRecorded,
  studentsList = [],
  schoolName,
  preselectedStudentId,
}: RecordPaymentModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentType, setPaymentType] = useState<string>("tuition");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Initialize preselected student
  useEffect(() => {
    if (preselectedStudentId && studentsList.length > 0) {
      const found = studentsList.find((s) => s.student_id === preselectedStudentId);
      if (found) {
        setSelectedStudent(found);
        if (found.pending_amount && found.pending_amount > 0) {
          setAmount(String(found.pending_amount));
        }
      }
    }
  }, [preselectedStudentId, studentsList]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      if (!preselectedStudentId) {
        setSelectedStudent(null);
        setAmount("");
      }
      setReferenceNumber(`REC-${Date.now().toString().slice(-6)}`);
      setPaymentMethod("cash");
      setPaymentType("tuition");
      setNotes("");
    }
  }, [isOpen, preselectedStudentId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentsList.slice(0, 10);
    return studentsList
      .filter((s) => {
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
        const adm = (s.admission_number || "").toLowerCase();
        return fullName.includes(q) || adm.includes(q);
      })
      .slice(0, 15);
  }, [studentsList, studentSearch]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error("Please select a student");
      return;
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApiJson<{
        data?: any;
        summary?: any;
        error?: string;
      }>("/api/payments/students", {
        method: "POST",
        body: JSON.stringify({
          studentId: selectedStudent.student_id,
          amount: numericAmount,
          paymentType,
          paymentMethod,
          referenceNumber: referenceNumber.trim() || undefined,
        }),
      });

      const studentName = `${selectedStudent.first_name || ""} ${selectedStudent.last_name || ""}`.trim() || "Student";
      const receiptNo = referenceNumber.trim() || `RCP-${Date.now().toString().slice(-6)}`;
      const prevBal = selectedStudent.pending_amount ?? numericAmount;
      const remBal = Math.max(0, prevBal - numericAmount);

      const receiptData: FeeReceiptData = {
        receiptNumber: receiptNo,
        schoolName: schoolName || "ZamSchool Academy",
        studentName,
        admissionNumber: selectedStudent.admission_number || null,
        className: selectedStudent.class_name || null,
        amountPaid: numericAmount,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || null,
        paidAt: new Date().toISOString(),
        feeDescription: PAYMENT_TYPES.find((t) => t.id === paymentType)?.label || "School Fees",
        previousBalance: prevBal,
        balanceRemaining: remBal,
        status: "CONFIRMED",
      };

      toast.success(`Payment of ${formatKwacha(numericAmount, { symbol: "K" })} recorded for ${studentName}`);
      onPaymentRecorded(receiptData);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Fee Payment</h3>
              <p className="text-xs text-slate-500">Record cash, mobile money, or bank wire deposit</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Student Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Select Student *
            </label>
            {selectedStudent ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-200 text-emerald-800 font-bold text-xs">
                    {(selectedStudent.first_name?.[0] || "S") + (selectedStudent.last_name?.[0] || "")}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </p>
                    <p className="text-xs text-slate-600">
                      Adm: <span className="font-mono">{selectedStudent.admission_number || "None"}</span>
                      {selectedStudent.class_name ? ` • Class: ${selectedStudent.class_name}` : ""}
                    </p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  {typeof selectedStudent.pending_amount === "number" && (
                    <div className="hidden sm:block">
                      <p className="text-[10px] uppercase font-semibold text-slate-500">Arrears Due</p>
                      <p className="text-xs font-bold text-amber-700">
                        {formatKwacha(selectedStudent.pending_amount, { symbol: "K" })}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setStudentSearch("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search student name or admission number..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white shadow-inner">
                  {filteredStudents.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-400">No matching students found.</p>
                  ) : (
                    filteredStudents.map((s) => (
                      <button
                        key={s.student_id}
                        type="button"
                        onClick={() => {
                          setSelectedStudent(s);
                          if (s.pending_amount && s.pending_amount > 0) {
                            setAmount(String(s.pending_amount));
                          }
                        }}
                        className="flex w-full items-center justify-between p-2.5 text-left text-xs hover:bg-sky-50 transition"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">
                            {s.first_name} {s.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {s.admission_number || "No adm #"}
                            {s.class_name ? ` • ${s.class_name}` : ""}
                          </p>
                        </div>
                        {typeof s.pending_amount === "number" && (
                          <div className="text-right">
                            <span className="font-semibold text-amber-700">
                              Due: {formatKwacha(s.pending_amount, { symbol: "K" })}
                            </span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Amount & Fee Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Amount (ZMW) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">K</span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Fee Category *
              </label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {PAYMENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Payment Method *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => {
                const Icon = m.icon;
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                      isSelected
                        ? "border-sky-500 bg-sky-50/80 ring-2 ring-sky-200"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <Icon className={`h-4 w-4 mb-1 ${isSelected ? "text-sky-600" : "text-slate-400"}`} />
                    <span className={`text-xs font-bold ${isSelected ? "text-sky-950" : "text-slate-800"}`}>
                      {m.label}
                    </span>
                    <span className="text-[10px] text-slate-400 leading-tight truncate w-full">{m.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reference Number & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Transaction / Slip Reference
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. MP260904.1234 or CHQ#9901"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-mono text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Cashier Remarks (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Paid in full by Mother"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedStudent || !Number(amount)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Recording payment…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Generate Receipt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
