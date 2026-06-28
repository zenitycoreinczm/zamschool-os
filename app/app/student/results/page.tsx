"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { GraduationCap, Download, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { secondaryButton } from "@/lib/workspace/design";
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

export default function StudentResultsPage() {
  const [exams, setExams] = useState<ExamCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const certRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/student/results/certificate");
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
  }, []);

  const toggleExpand = (idx: number) => {
    setExpandedIdx(expandedIdx === idx ? null : idx);
  };

  const setCertRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (el) certRefs.current.set(idx, el);
  }, []);

  const handleDownload = async (idx: number) => {
    const el = certRefs.current.get(idx);
    if (!el) return;
    setDownloading(idx);
    try {
      const dataUrl = await toPng(el, {
        quality: 0.95,
        pixelRatio: 2,
        width: 794,
        style: { transform: "scale(1)", transformOrigin: "top left" },
      });
      const link = document.createElement("a");
      link.download = `Statement_of_Results_${exams[idx].examTitle.replace(/\s+/g, "_")}.png`;
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
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Results</h1>
        <p className="text-sm text-slate-500">
          View and download your academic result certificates
        </p>
      </div>

      {error ? (
        <Surface variant="elevated" className="p-6 text-center">
          <p className="text-sm text-rose-600">{error}</p>
        </Surface>
      ) : exams.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">
            No published results yet.
          </p>
        </Surface>
      ) : (
        <div className="space-y-4">
          {exams.map((exam, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div
                key={`${exam.examTitle}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  onClick={() => toggleExpand(idx)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
                      <GraduationCap className="h-5 w-5 text-sky-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {exam.examTitle}
                      </div>
                      <div className="text-sm text-slate-500">
                        {exam.className} · {exam.subjects.length} subjects
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
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
                      <ChevronUp className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-4 pb-4">
                    <div className="mt-4 overflow-x-auto">
                      <StatementOfResults
                        ref={(el) => setCertRef(idx, el)}
                        studentName={exam.studentName}
                        examNumber={exam.examNumber}
                        schoolName={exam.schoolName}
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
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => handleDownload(idx)}
                        disabled={downloading === idx}
                        className={secondaryButton("disabled:opacity-50")}
                      >
                        {downloading === idx ? (
                          <>Downloading...</>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            Download Certificate
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
