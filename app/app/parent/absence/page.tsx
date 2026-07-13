"use client";

import { useEffect, useRef, useState } from "react";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { AlertCircle, CalendarCheck, Send } from "lucide-react";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";

type AbsenceRow = {
  id: string;
  studentId: string;
  studentName: string;
  date: string;
  status: string;
  remarks: string | null;
  createdAt: string;
};

export default function ParentAbsencePage() {
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [selectedChild, setSelectedChild] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formChild, setFormChild] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const load = async () => {
      const [childrenRes, absenceRes] = await Promise.all([
        fetch("/api/parent/children"),
        fetch("/api/parent/absence"),
      ]);

      if (childrenRes.ok) {
        const body = await childrenRes.json();
        setChildren(body.data ?? []);
      }

      if (absenceRes.ok) {
        const body = await absenceRes.json();
        setAbsences(body.data ?? []);
      } else {
        setError("Failed to load absence records");
      }

      setLoading(false);
    };

    void load();
  }, []);

  const filteredAbsences = selectedChild
    ? absences.filter((a) => a.studentId === selectedChild)
    : absences;

  const handleSubmit = async () => {
    if (!formChild || !formDate || !formReason) return;
    setSubmitting(true);
    setSubmitMessage("");

    const res = await fetch("/api/parent/absence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: formChild,
        date: formDate,
        reason: formReason,
      }),
    });

    if (res.ok) {
      setSubmitMessage("Absence justification submitted successfully.");
      setShowForm(false);
      setFormChild("");
      setFormDate("");
      setFormReason("");
    } else {
      const body = await res.json();
      setSubmitMessage(body.error || "Failed to submit justification.");
    }
    setSubmitting(false);
  };

  if (loading) return <WorkspaceLoader label="Loading absences" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Absence Records</h1>
          <p className="text-sm text-slate-500">
            View and justify absence records for your children
          </p>
        </div>
        <div className="flex gap-2">
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            <Send className="h-4 w-4" />
            Justify Absence
          </button>
        </div>
      </div>

      {showForm && (
        <Surface variant="elevated" className="p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Submit Absence Justification
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <select
              value={formChild}
              onChange={(e) => setFormChild(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Select child</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.displayName}
                </option>
              ))}
            </select>
            <DateOnlyPicker
              value={formDate}
              onChange={setFormDate}
              label="Absence date"
              accent="slate"
            />
            <input
              type="text"
              value={formReason}
              onChange={(e) => setFormReason(e.target.value)}
              placeholder="Reason for absence"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || !formChild || !formDate || !formReason}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {submitMessage && (
            <p className="mt-3 text-sm text-slate-600">{submitMessage}</p>
          )}
        </Surface>
      )}

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        </Surface>
      ) : filteredAbsences.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No absence records found.
          </p>
        </Surface>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Child
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAbsences.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="px-4 py-3 text-slate-900">{row.date}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {row.studentName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.remarks || "—"}
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
