"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Info,
  Loader2,
  PenLine,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getECZGrade } from "@/lib/zambia-localization";
import type { MatchableStudent } from "@/lib/results/match-students";

type DirectMarksEntryGridProps = {
  students: MatchableStudent[];
  marks: Record<string, string>;
  remarks: Record<string, string>;
  onMarkChange: (studentId: string, val: string) => void;
  onRemarkChange: (studentId: string, val: string) => void;
  totalMarks: number;
  onSave: () => void;
  isSaving: boolean;
  lastAutosaved: string | null;
  onPrefillZero: () => void;
  onClearAll: () => void;
  subjectName?: string;
  className?: string;
};

export function DirectMarksEntryGrid({
  students,
  marks,
  remarks,
  onMarkChange,
  onRemarkChange,
  totalMarks,
  onSave,
  isSaving,
  lastAutosaved,
  onPrefillZero,
  onClearAll,
  subjectName,
  className,
}: DirectMarksEntryGridProps) {
  const [search, setSearch] = useState("");

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        s.displayName.toLowerCase().includes(q) ||
        (s.admissionNumber && s.admissionNumber.toLowerCase().includes(q)) ||
        (s.classNumber != null && String(s.classNumber).includes(q)),
    );
  }, [students, search]);

  const stats = useMemo(() => {
    const validScores: number[] = [];
    let count = 0;
    for (const s of students) {
      const raw = marks[s.id];
      if (raw !== undefined && raw !== "" && !isNaN(Number(raw))) {
        count++;
        const val = Number(raw);
        if (val >= 0 && val <= totalMarks) {
          validScores.push(val);
        }
      }
    }
    const total = students.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const avg =
      validScores.length > 0
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
        : null;
    const max = validScores.length > 0 ? Math.max(...validScores) : null;
    const min = validScores.length > 0 ? Math.min(...validScores) : null;

    return {
      enteredCount: count,
      totalStudents: total,
      percentComplete: pct,
      average: avg,
      highest: max,
      lowest: min,
      hasAnyMarks: count > 0,
    };
  }, [students, marks, totalMarks]);

  if (students.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-400" />
        <h4 className="mt-2 text-sm font-bold text-slate-900">No students enrolled</h4>
        <p className="mt-1 text-xs text-slate-500">
          This class has no student records yet. Assign students to this class in the admin portal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Control / Status Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Progress & Autosave */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              {stats.enteredCount} of {stats.totalStudents} Marks Entered
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                stats.percentComplete === 100
                  ? "bg-emerald-100 text-emerald-800"
                  : stats.percentComplete > 0
                    ? "bg-sky-100 text-sky-800"
                    : "bg-slate-100 text-slate-600",
              )}
            >
              {stats.percentComplete}% Complete
            </span>
            {lastAutosaved ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Draft saved {lastAutosaved}
              </span>
            ) : null}
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-48 sm:w-64 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                stats.percentComplete === 100 ? "bg-emerald-500" : "bg-sky-500",
              )}
              style={{ width: `${stats.percentComplete}%` }}
            />
          </div>
        </div>

        {/* Search & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[140px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find student…"
              className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <button
            type="button"
            onClick={onPrefillZero}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            title="Set 0 for students with no mark"
          >
            Zero Unentered
          </button>

          {stats.hasAnyMarks && (
            <button
              type="button"
              onClick={onClearAll}
              className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition cursor-pointer"
              title="Clear all entered marks"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Keyboard navigation helper pill */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          Press <kbd className="rounded bg-slate-200 px-1 font-mono font-bold text-slate-700">Enter</kbd> or{" "}
          <kbd className="rounded bg-slate-200 px-1 font-mono font-bold text-slate-700">↓</kbd> to jump to next student
        </span>
        {stats.average !== null && (
          <span className="font-semibold text-slate-700">
            Class Avg: <strong className="text-slate-900">{stats.average}</strong> / {totalMarks}
            {stats.highest !== null ? ` • High: ${stats.highest}` : ""}
            {stats.lowest !== null ? ` • Low: ${stats.lowest}` : ""}
          </span>
        )}
      </div>

      {/* Student Marks Sheet Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[11px] sticky top-0">
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Student Name & Admission</th>
              <th className="py-3 px-4 w-32">Mark (Max: {totalMarks})</th>
              <th className="py-3 px-4 w-44">ECZ Grade</th>
              <th className="py-3 px-4">Remarks (Optional)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.map((student, index) => {
              const rawMark = marks[student.id] ?? "";
              const remark = remarks[student.id] ?? "";
              const num = Number(rawMark);
              const hasVal = rawMark !== "" && !isNaN(num);
              const isInvalid = hasVal && (num < 0 || num > totalMarks);
              const eczGrade = hasVal && !isInvalid ? getECZGrade((num / totalMarks) * 100) : null;

              return (
                <tr
                  key={student.id}
                  className={cn(
                    "transition hover:bg-slate-50/60",
                    isInvalid && "bg-rose-50/40",
                    hasVal && !isInvalid && "bg-sky-50/20",
                  )}
                >
                  <td className="py-2.5 px-4 text-center font-mono font-semibold text-slate-500 text-[11px]">
                    {student.classNumber ? `#${student.classNumber}` : index + 1}
                  </td>
                  <td className="py-2.5 px-4">
                    <p className="font-bold text-slate-900 text-sm">{student.displayName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {student.admissionNumber ? student.admissionNumber : "No Adm #"}
                    </p>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="relative">
                      <input
                        id={`mark-input-${index}`}
                        type="number"
                        min="0"
                        max={totalMarks}
                        step="any"
                        value={rawMark}
                        onChange={(e) => onMarkChange(student.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === "ArrowDown") {
                            e.preventDefault();
                            const next = document.getElementById(`mark-input-${index + 1}`);
                            if (next) (next as HTMLInputElement).focus();
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            const prev = document.getElementById(`mark-input-${index - 1}`);
                            if (prev) (prev as HTMLInputElement).focus();
                          }
                        }}
                        placeholder="—"
                        className={cn(
                          "w-24 rounded-xl border px-3 py-1.5 text-center font-bold text-sm outline-none transition",
                          isInvalid
                            ? "border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200"
                            : hasVal
                              ? "border-sky-400 bg-sky-50/60 text-slate-900"
                              : "border-slate-300 bg-white text-slate-700 focus:border-sky-400 focus:ring-2 focus:ring-sky-100",
                        )}
                      />
                      {isInvalid && (
                        <span className="absolute -bottom-4 left-0 text-[10px] font-bold text-rose-600 whitespace-nowrap">
                          Must be 0–{totalMarks}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    {eczGrade ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold shadow-2xs",
                          eczGrade.points <= 2
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : eczGrade.points <= 4
                              ? "bg-sky-100 text-sky-800 border border-sky-200"
                              : eczGrade.points <= 6
                                ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                : eczGrade.points <= 8
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-rose-100 text-rose-800 border border-rose-200",
                        )}
                      >
                        Grade {eczGrade.points} • {eczGrade.label}
                      </span>
                    ) : isInvalid ? (
                      <span className="text-xs font-semibold text-rose-600">Out of range</span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Not graded</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={remark}
                      onChange={(e) => onRemarkChange(student.id, e.target.value)}
                      placeholder="Optional remarks…"
                      className="w-full max-w-xs rounded-lg border border-slate-200 bg-white py-1 px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Save Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="text-xs text-slate-600">
          Ready to save marks for <strong className="text-slate-900">{subjectName || "Subject"}</strong> ({className || "Class"}).
          You will be able to review and publish to parents in the next step.
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || !stats.hasAnyMarks}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 transition disabled:opacity-50 cursor-pointer"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving results…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save & Review Results
            </>
          )}
        </button>
      </div>
    </div>
  );
}
