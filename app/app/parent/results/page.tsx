"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import {
  StatementOfResults,
  type SubjectResult,
} from "@/components/results/StatementOfResults";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";

type ExamCertificate = {
  examTitle: string;
  studentName: string;
  examNumber: string;
  className: string;
  schoolName: string;
  year: number;
  publishedAt: string;
  teacherName: string;
  subjects: SubjectResult[];
  totalScore: number;
  totalPossible: number;
  average: number;
  overallGrade: string;
  position: string;
  classSize: number;
  verificationCode: string;
};

type ChildOption = { id: string; displayName: string };

function normalizeSubject(raw: Record<string, unknown>): SubjectResult {
  const name = String(raw.name || raw.subjectName || "Subject");
  const code = String(raw.code || raw.subjectCode || "");
  const grade = String(raw.grade || "N/A");
  const score = Number(raw.score ?? 0);
  const totalMarks = Number(raw.totalMarks ?? raw.total_marks ?? 100);
  const performance = String(
    raw.performance ||
      (grade.startsWith("A")
        ? "Excellent"
        : grade.startsWith("B")
          ? "Good"
          : grade.startsWith("C")
            ? "Satisfactory"
            : grade === "D"
              ? "Pass"
              : "N/A"),
  );
  return {
    name,
    code,
    score: Number.isFinite(score) ? score : 0,
    grade,
    totalMarks: Number.isFinite(totalMarks) ? totalMarks : 100,
    performance,
  };
}

function normalizeExam(raw: Record<string, unknown>): ExamCertificate | null {
  if (!raw || typeof raw !== "object") return null;
  const subjectsRaw = Array.isArray(raw.subjects) ? raw.subjects : [];
  const subjects = subjectsRaw
    .map((s) =>
      s && typeof s === "object"
        ? normalizeSubject(s as Record<string, unknown>)
        : null,
    )
    .filter(Boolean) as SubjectResult[];

  return {
    examTitle: String(raw.examTitle || raw.title || "Exam"),
    studentName: String(raw.studentName || "Student"),
    examNumber: String(raw.examNumber || raw.studentNumber || "-"),
    className: String(raw.className || "Class"),
    schoolName: String(raw.schoolName || "School"),
    year: Number(raw.year) || new Date().getFullYear(),
    publishedAt: String(raw.publishedAt || new Date().toISOString()),
    teacherName: String(raw.teacherName || "Teacher"),
    subjects,
    totalScore: Number(raw.totalScore ?? 0),
    totalPossible: Number(raw.totalPossible ?? 0),
    average: Number(raw.average ?? 0),
    overallGrade: String(raw.overallGrade || "PASS"),
    position: String(raw.position || "-"),
    classSize: Number(raw.classSize ?? 0),
    verificationCode: String(raw.verificationCode || ""),
  };
}

function safeFilePart(value: string) {
  return String(value || "file")
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 60);
}

export default function ParentResultsPage() {
  const [exams, setExams] = useState<ExamCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [children, setChildren] = useState<ChildOption[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [downloading, setDownloading] = useState<number | null>(null);
  const certRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const loadKey = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadChildren = async () => {
      try {
        const res = await fetchWithOfflineSupport("/api/parent/children", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = await res.json();
        const rows = Array.isArray(body?.data) ? body.data : [];
        if (cancelled) return;
        setChildren(
          rows.map((c: Record<string, unknown>) => ({
            id: String(c.id || c.profileId || ""),
            displayName: String(
              c.displayName ||
                c.name ||
                [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                "Child",
            ),
          })).filter((c: ChildOption) => c.id),
        );
      } catch {
        // non-blocking - results still load for all children
      }
    };
    void loadChildren();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const current = ++loadKey.current;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = selectedChild
          ? `?studentId=${encodeURIComponent(selectedChild)}&groupBy=exam`
          : "?groupBy=exam";
        const res = await fetchWithOfflineSupport(`/api/parent/results${params}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (current !== loadKey.current) return;
        if (!res.ok) {
          setError("Failed to load results. Try again.");
          setExams([]);
          setLoading(false);
          return;
        }
        const body = await res.json();
        const rawExams = Array.isArray(body?.data?.exams)
          ? body.data.exams
          : Array.isArray(body?.data)
            ? []
            : [];
        const normalized = rawExams
          .map((row: unknown) =>
            row && typeof row === "object"
              ? normalizeExam(row as Record<string, unknown>)
              : null,
          )
          .filter(Boolean) as ExamCertificate[];
        setExams(normalized);
        setExpandedIdx(normalized.length > 0 ? 0 : null);
      } catch {
        if (current !== loadKey.current) return;
        setError("Failed to load results. Check your connection and try again.");
        setExams([]);
      } finally {
        if (current === loadKey.current) setLoading(false);
      }
    };
    void load();
  }, [selectedChild]);

  const handleChildChange = (childId: string) => {
    setSelectedChild(childId);
    setExpandedIdx(null);
  };

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  const setCertRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) certRefs.current.set(idx, el);
    else certRefs.current.delete(idx);
  }, []);

  const handleDownload = async (idx: number) => {
    const exam = exams[idx];
    if (!exam) return;

    if (expandedIdx !== idx) {
      setExpandedIdx(idx);
      await new Promise((r) => setTimeout(r, 120));
    }

    const el = certRefs.current.get(idx);
    if (!el) {
      window.print();
      return;
    }

    setDownloading(idx);
    try {
      const dataUrl = await toPng(el, {
        quality: 0.95,
        pixelRatio: 2,
        width: 794,
        backgroundColor: "#ffffff",
        cacheBust: true,
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });
      const link = document.createElement("a");
      link.download = `Certificate_${safeFilePart(exam.studentName)}_${safeFilePart(exam.className)}_${safeFilePart(exam.examTitle)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("[parent-results] certificate download failed", err);
      window.print();
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return <WorkspaceLoader label="Loading results" />;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Results</h1>
          <p className="text-sm text-slate-500">
            Download your children&apos;s multi-subject Statement of Results
            (school, class, subjects, grades).
          </p>
        </div>
        {children.length > 1 ? (
          <select
            value={selectedChild}
            onChange={(e) => handleChildChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">All children</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.displayName}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setSelectedChild((c) => c);
              // re-trigger load by flipping key via force setState
              loadKey.current += 1;
              void (async () => {
                try {
                  const params = selectedChild
                    ? `?studentId=${encodeURIComponent(selectedChild)}&groupBy=exam`
                    : "?groupBy=exam";
                  const res = await fetchWithOfflineSupport(
                    `/api/parent/results${params}`,
                    { credentials: "include", cache: "no-store" },
                  );
                  if (!res.ok) throw new Error("fail");
                  const body = await res.json();
                  const rawExams = Array.isArray(body?.data?.exams)
                    ? body.data.exams
                    : [];
                  setExams(
                    rawExams
                      .map((row: unknown) =>
                        row && typeof row === "object"
                          ? normalizeExam(row as Record<string, unknown>)
                          : null,
                      )
                      .filter(Boolean) as ExamCertificate[],
                  );
                  setError("");
                } catch {
                  setError("Failed to load results. Try again.");
                } finally {
                  setLoading(false);
                }
              })();
            }}
            className="mt-3 text-sm font-semibold text-sky-700 underline"
          >
            Try again
          </button>
        </Surface>
      ) : exams.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No published results yet. Certificates appear when teachers publish
            marks for an exam.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {exams.map((exam, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={`${exam.examTitle}-${exam.studentName}-${exam.verificationCode || idx}`}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(idx)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">
                        {exam.examTitle}
                      </div>
                      <div className="text-sm text-slate-500">
                        {exam.studentName} · {exam.schoolName} · {exam.className}{" "}
                        · {exam.subjects.length} subjects
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                        exam.overallGrade === "DISTINCTION"
                          ? "bg-emerald-100 text-emerald-700"
                          : exam.overallGrade === "CREDIT"
                            ? "bg-blue-100 text-blue-700"
                            : exam.overallGrade === "PASS"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-rose-100 text-rose-700",
                      )}
                    >
                      {exam.overallGrade}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownload(idx)}
                    disabled={downloading === idx}
                    className={primaryButton("disabled:opacity-50 shrink-0")}
                  >
                    {downloading === idx ? (
                      <>Downloading…</>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download certificate
                      </>
                    )}
                  </button>
                </div>

                {/* Always mount cert so download works without expanding first */}
                <div
                  className={cn(
                    "border-t border-slate-100 px-4 pb-4",
                    !isExpanded && "absolute left-[-10000px] top-0 w-[794px]",
                  )}
                  aria-hidden={!isExpanded}
                >
                  <div className="mt-4 overflow-x-auto">
                    <StatementOfResults
                      ref={(el) => setCertRef(idx, el)}
                      studentName={exam.studentName}
                      examNumber={exam.examNumber}
                      schoolName={exam.schoolName}
                      className={exam.className}
                      examYear={exam.year}
                      examTitle={exam.examTitle}
                      subjects={exam.subjects}
                      overallGrade={exam.overallGrade}
                      totalScore={exam.totalScore}
                      totalPossible={exam.totalPossible}
                      average={exam.average}
                      position={exam.position}
                      classSize={exam.classSize}
                      verificationCode={exam.verificationCode}
                      publishedAt={exam.publishedAt}
                      teacherName={exam.teacherName}
                    />
                  </div>
                  {isExpanded ? (
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => void handleDownload(idx)}
                        disabled={downloading === idx}
                        className={secondaryButton("disabled:opacity-50")}
                      >
                        <Download className="h-4 w-4" />
                        Download certificate
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
