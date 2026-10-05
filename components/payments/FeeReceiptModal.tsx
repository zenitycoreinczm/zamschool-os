"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, Download, Printer, ShieldCheck, X } from "lucide-react";
import { formatKwacha } from "@/lib/zambia-localization";

export type FeeReceiptData = {
  receiptNumber: string;
  schoolName?: string;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  studentName: string;
  admissionNumber?: string | null;
  className?: string | null;
  amountPaid: number;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
  paidAt?: string | null;
  feeDescription?: string | null;
  previousBalance?: number | null;
  balanceRemaining?: number | null;
  cashierName?: string | null;
  status?: string;
};

type FeeReceiptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  receipt: FeeReceiptData | null;
};

export function FeeReceiptModal({
  isOpen,
  onClose,
  receipt,
}: FeeReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = receipt.paidAt
    ? new Date(receipt.paidAt).toLocaleDateString("en-ZM", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : new Date().toLocaleDateString("en-ZM", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const methodLabel = formatMethod(receipt.paymentMethod);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden print:shadow-none print:border-none print:max-w-none print:max-h-none">
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Official Payment Receipt</h3>
              <p className="text-xs text-slate-500 font-mono">#{receipt.receiptNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div
          ref={printRef}
          className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-slate-900 print:overflow-visible print:p-4"
        >
          {/* Header & Emblem */}
          <div className="border-b-2 border-slate-900 pb-5 text-center relative">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-slate-900 bg-slate-100 text-slate-900 font-bold text-xl tracking-wider">
              {receipt.schoolName ? receipt.schoolName.slice(0, 2).toUpperCase() : "ZS"}
            </div>
            <h1 className="text-xl font-extrabold uppercase tracking-wide text-slate-950">
              {receipt.schoolName || "ZamSchool Academy"}
            </h1>
            <p className="text-xs font-medium text-slate-600 mt-0.5">
              {[receipt.schoolAddress, receipt.schoolPhone, receipt.schoolEmail]
                .filter(Boolean)
                .join(" • ") || "Ministry of Education • Republic of Zambia"}
            </p>
            <div className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-white">
              Official Fee Receipt
            </div>
          </div>

          {/* Meta Bar */}
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
            <div>
              <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Receipt No.</p>
              <p className="font-mono font-bold text-slate-900 text-sm">{receipt.receiptNumber}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Date & Time</p>
              <p className="font-medium text-slate-800">{formattedDate}</p>
            </div>
          </div>

          {/* Student & Class Details */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Student Particulars</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500">Student Name:</span>{" "}
                <strong className="text-slate-900 font-semibold">{receipt.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Admission No:</span>{" "}
                <span className="font-mono font-bold text-slate-900">{receipt.admissionNumber || "N/A"}</span>
              </div>
              {receipt.className ? (
                <div>
                  <span className="text-slate-500">Class / Grade:</span>{" "}
                  <strong className="text-slate-900">{receipt.className}</strong>
                </div>
              ) : null}
              <div>
                <span className="text-slate-500">Payment Channel:</span>{" "}
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800">
                  {methodLabel}
                </span>
              </div>
              {receipt.referenceNumber ? (
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Transaction Ref:</span>{" "}
                  <span className="font-mono font-semibold text-slate-900">{receipt.referenceNumber}</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Payment Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 text-slate-700">
                <tr>
                  <th className="py-2.5 px-4 font-bold">Description</th>
                  <th className="py-2.5 px-4 text-right font-bold">Amount (ZMW)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <tr>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-slate-900">{receipt.feeDescription || "School Fees Payment"}</p>
                    <p className="text-[11px] text-slate-500">Verified via Bursar Finance Office</p>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900 text-sm">
                    {formatKwacha(receipt.amountPaid, { symbol: "K" })}
                  </td>
                </tr>
              </tbody>
              <tfoot className="border-t-2 border-slate-900 bg-slate-50 text-xs font-semibold">
                <tr>
                  <td className="py-2.5 px-4 text-slate-900 font-bold uppercase">Total Paid</td>
                  <td className="py-2.5 px-4 text-right font-extrabold text-emerald-700 text-base">
                    {formatKwacha(receipt.amountPaid, { symbol: "K" })}
                  </td>
                </tr>
                {typeof receipt.balanceRemaining === "number" ? (
                  <tr>
                    <td className="py-2 px-4 text-slate-600">Balance Remaining</td>
                    <td
                      className={`py-2 px-4 text-right font-bold ${
                        receipt.balanceRemaining > 0 ? "text-amber-700" : "text-slate-700"
                      }`}
                    >
                      {formatKwacha(receipt.balanceRemaining, { symbol: "K" })}
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-4 grid grid-cols-2 gap-8 text-xs border-t border-dashed border-slate-300">
            <div>
              <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Issued By</p>
              <div className="mt-4 border-b border-slate-400 w-36"></div>
              <p className="mt-1 font-medium text-slate-800">{receipt.cashierName || "Bursar / Accounts Office"}</p>
            </div>
            <div className="flex flex-col items-end text-right">
              <p className="font-semibold text-slate-500 uppercase text-[10px] tracking-wider">Stamp & Verification</p>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-xl border-2 border-emerald-600/60 bg-emerald-50/80 px-3 py-1.5 text-emerald-900 text-[11px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                Verified Payment
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center pt-2 text-[10px] text-slate-400 border-t border-slate-100">
            This is an official computer-generated receipt from ZamSchool OS. Retain for school audit and term clearance.
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMethod(method?: string | null): string {
  if (!method) return "Cash";
  const m = method.toLowerCase();
  if (m.includes("airtel")) return "Airtel Money";
  if (m.includes("mtn")) return "MTN MoMo";
  if (m.includes("zamtel")) return "Zamtel Kwacha";
  if (m.includes("bank") || m.includes("transfer")) return "Bank Transfer";
  if (m.includes("cheque") || m.includes("check")) return "Cheque";
  if (m.includes("cash")) return "Cash";
  return method.toUpperCase();
}
