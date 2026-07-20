"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import {
  Download,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import {
  StatementOfResults,
  type SubjectResult,
} from "@/components/results/StatementOfResults";

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

export default function ParentResultsPage() {
  const [exams, setExams] = useState<ExamCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [children, setChildren] = useState<
    Array<{ id: string; displayName: string }>
  >([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [downloading, setDownloading] = useState<number | null>(null);
  const certRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const loadKey = useRef(0);

  useEffect(() => {
    const loadChildren = async () => {
      const res = await fetch("/api/parent/children");
      if (res.ok) {
        const body = await res.json();
        setChildren(body.data ?? []);
      }
    };
    void loadChildren();
  }, []);

  useEffect(() => {
    const current = ++loadKey.current;
    const load = async () => {
      const params = selectedChild
        ? `?studentId=${selectedChild}&groupBy=exam`
        : "?groupBy=exam";
      const res = await fetch(`/api/parent/results${params}`);
      if (current !== loadKey.current) return;
      if (!res.ok) {
        setError("Failed to load results");
        setLoading(false);
        return;
      }
      const body = await res.json();
      setExams(body.data?.exams ?? []);
      setLoading(false);
    };
    void load();
  }, [selectedChild]);

  const handleChildChange = (childId: string) => {
    setLoading(true);
    setError("");
    setSelectedChild(childId);
    setExpandedIdx(null);
  };

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  const setCertRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) certRefs.current.set(idx, el);
  }, []);

  const handleDownload = async (idx: number) => {
    if (expandedIdx !== idx) {
      setExpandedIdx(idx);
      await new Promise((r) => setTimeout(r, 80));
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
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });
      const exam = exams[idx];
      const link = document.createElement("a");
      link.download = `Certificate_${exam.studentName.replace(/\s+/g, "_")}_${exam.className.replace(/\s+/g, "_")}_${exam.examTitle.replace(/\s+/g, "_")}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      window.print();
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return <WorkspaceLoader label="Loading results" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Results</h1>
          <p className="text-sm text-slate-500">
            Your children&apos;s academic result certificates
          </p>
        </div>
        {children.length > 1 && (
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
        )}
      </div>

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
        </Surface>
      ) : exams.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No published results yet.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {exams.map((exam, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={`${exam.examTitle}-${exam.studentName}-${idx}`}
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

                <div
                  className={cn(
                    "border-t border-slate-100 px-4 pb-4",
                    !isExpanded && "sr-only",
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
