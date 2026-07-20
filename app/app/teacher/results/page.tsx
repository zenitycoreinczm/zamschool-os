"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  Loader2,
  Search,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Send,
  Eye,
  X,
  ArrowRight,
  Download,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { adminApiFetch, adminApiJson } from "@/lib/admin-browser-api";
import { getECZGrade } from "@/lib/zambia-localization";

type Subject = { id: string; name: string; code: string | null };
type ClassItem = { id: string; name: string };

type ParsedRow = {
  identifier: string;
  marks: number | null;
  grade: string | null;
  matchedStudent: string | null;
};

type UploadResult = {
  assignmentId?: string;
  subjectName: string;
  subjectCode: string | null;
  className: string;
  examTitle: string;
  totalMarks: number;
  resultsCreated: number;
  resultsUpdated: number;
  totalMatched: number;
  unmatchedStudents: string[];
  warnings: string[];
};

type CompletenessStudent = {
  studentId: string;
  studentName: string;
  examNumber: string;
  expectedSubjects: number;
  uploadedSubjects: number;
  isComplete: boolean;
  missingSubjects: string[];
  subjects: Array<{
    subjectId: string;
    subjectName: string;
    subjectCode: string | null;
    score: number | null;
    grade: string | null;
  }>;
};

type CompletenessData = {
  students: CompletenessStudent[];
  summary: {
    totalStudents: number;
    completeStudents: number;
    incompleteStudents: number;
    expectedSubjectCount: number;
    uploadedSubjectCount: number;
  };
  className: string;
  examTitle: string;
};

type StudentLookup = {
  id: string;
  admissionNumber: string | null;
  displayName: string;
};

const STUDENT_ID_COL_KEYS = [
  "exam_number",
  "exam_no",
  "examno",
  "admission_number",
  "admission_no",
  "student_number",
  "student_no",
  "student_id",
  "id",
  "registration",
  "reg_no",
];
const MARKS_COL_KEYS = [
  "marks",
  "mark",
  "score",
  "points",
  "total",
  "raw_marks",
];
const GRADE_COL_KEYS = ["grade", "letter", "grade_letter", "letter_grade"];

export default function TeacherResultsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<StudentLookup[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [completeness, setCompleteness] = useState<CompletenessData | null>(
    null,
  );
  const [loadingCompleteness, setLoadingCompleteness] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    try {
      const [subjRes, classRes] = await Promise.all([
        adminApiJson("/api/teacher/subjects"),
        adminApiJson("/api/teacher/classes"),
      ]);
      setSubjects(subjRes.data || []);
      const classList = (classRes.data || []).map((c: any) => ({
        id: c.classId || c.id,
        name: c.className || c.name || "Class",
      }));
      setClasses(classList);
      if (classList.length === 1) setSelectedClass(classList[0].id);
    } catch {
      toast.error("Failed to load data");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedClass) return;
    adminApiJson("/api/teacher/students")
      .then((body) => {
        const allStudents: StudentLookup[] = (body.data?.students || [])
          .filter((s: any) => s.classId === selectedClass)
          .map((s: any) => ({
            id: s.id,
            admissionNumber: s.admissionNumber || null,
            displayName: s.displayName,
          }));
        setStudents(allStudents);
      })
      .catch(() => {});
  }, [selectedClass]);

  const studentLookup = useMemo(() => {
    const map = new Map<string, StudentLookup>();
    for (const s of students) {
      if (s.admissionNumber) map.set(s.admissionNumber.toLowerCase(), s);
      map.set(s.id.toLowerCase(), s);
    }
    return map;
  }, [students]);

  const parseFile = useCallback(
    async (f: File) => {
      setPreviewLoading(true);
      setParsedRows(null);
      setShowPreview(false);

      try {
        const name = f.name.toLowerCase();
        let rows: Record<string, string>[];

        if (name.endsWith(".csv")) {
          const text = await f.text();
          const result = Papa.parse<Record<string, string>>(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) =>
              h
                .toLowerCase()
                .replace(/[^a-z0-9_]+/g, "_")
                .replace(/^_|_$/g, "")
                .trim(),
          });
          if (result.errors.length > 0) {
            const e = result.errors[0];
            throw new Error(`CSV error at row ${e.row}: ${e.message}`);
          }
          rows = result.data;
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const XLSX = await import("xlsx");
          const buffer = await f.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          if (!ws) throw new Error("Excel file has no sheets");
          const data = XLSX.utils.sheet_to_json<string[]>(ws, {
            header: 1,
            defval: "",
          }) as string[][];
          if (data.length < 2)
            throw new Error(
              "Excel file must have a header row and at least one data row",
            );
          const headers = (data[0] || []).map((h) =>
            h
              .toLowerCase()
              .replace(/[^a-z0-9_]+/g, "_")
              .replace(/^_|_$/g, "")
              .trim(),
          );
          rows = [];
          for (let i = 1; i < data.length; i++) {
            const row: Record<string, string> = {};
            for (let j = 0; j < headers.length; j++) {
              row[headers[j]] = (data[i]?.[j] || "").toString().trim();
            }
            if (Object.values(row).some((v) => v)) rows.push(row);
          }
        } else {
          throw new Error(
            "Unsupported file format. Use CSV or Excel (.xlsx/.xls).",
          );
        }

        if (rows.length === 0) {
          throw new Error("No data rows found in file");
        }

        const parsed: ParsedRow[] = [];
        for (const row of rows) {
          const identifier = pickFirst(row, STUDENT_ID_COL_KEYS);
          if (!identifier.trim()) continue;

          const rawMarks = pickFirst(row, MARKS_COL_KEYS);
          let marks: number | null = null;
          if (rawMarks.trim()) {
            marks = Number(rawMarks);
            if (isNaN(marks)) continue;
          }
          let grade = pickFirst(row, GRADE_COL_KEYS) || null;
          if (!grade && marks !== null) {
            try {
              const scale = getECZGrade(marks);
              grade = `${scale.grade} (${scale.label})`;
            } catch {}
          }
          const matched = studentLookup.get(identifier.trim().toLowerCase());

          parsed.push({
            identifier: identifier.trim(),
            marks,
            grade,
            matchedStudent: matched?.displayName || null,
          });
        }

        setParsedRows(parsed);
        setShowPreview(true);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to parse file";
        toast.error(msg);
      } finally {
        setPreviewLoading(false);
      }
    },
    [studentLookup],
  );

  useEffect(() => {
    if (file && selectedClass) {
      parseFile(file);
    } else {
      setParsedRows(null);
      setShowPreview(false);
    }
  }, [file, selectedClass, parseFile]);

  const matchedCount = useMemo(
    () => parsedRows?.filter((r) => r.matchedStudent).length ?? 0,
    [parsedRows],
  );
  const unmatchedCount = useMemo(
    () => parsedRows?.filter((r) => !r.matchedStudent).length ?? 0,
    [parsedRows],
  );

  const checkCompleteness = useCallback(async () => {
    if (!selectedClass || !examTitle.trim()) return;
    setLoadingCompleteness(true);
    try {
      const body = await adminApiJson(
        `/api/teacher/results-completeness?classId=${selectedClass}&examTitle=${encodeURIComponent(examTitle.trim())}`,
      );
      setCompleteness(body.data || null);
    } catch {
      toast.error("Failed to check completeness");
    } finally {
      setLoadingCompleteness(false);
    }
  }, [selectedClass, examTitle]);

  useEffect(() => {
    if (selectedClass && examTitle.trim()) {
      const timer = setTimeout(checkCompleteness, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedClass, examTitle, checkCompleteness]);

  const handleUpload = async () => {
    if (!file || !selectedClass || !selectedSubject || !examTitle.trim()) {
      toast.error("Please fill all fields and select a file");
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subjectId", selectedSubject);
      formData.append("examTitle", examTitle.trim());
      formData.append("totalMarks", totalMarks);
      formData.append("classId", selectedClass);

      const res = await adminApiFetch("/api/teacher/results-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error || "Upload failed");
        return;
      }

      const body = await res.json();
      setUploadResult(body.data);
      toast.success(
        `${body.data.resultsCreated} results created, ${body.data.resultsUpdated} updated`,
      );
      setFile(null);
      setParsedRows(null);
      setShowPreview(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      checkCompleteness();
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async (opts?: { assignmentId?: string; subjectOnly?: boolean }) => {
    if (!selectedClass || !examTitle.trim()) {
      if (!opts?.assignmentId) {
        toast.error("Select a class and enter an exam title first");
        return;
      }
    }
    setPublishing(true);
    try {
      const payload = opts?.assignmentId
        ? {
            assignmentId: opts.assignmentId,
            subjectOnly: true as const,
          }
        : {
            examTitle: examTitle.trim(),
            classId: selectedClass,
            subjectOnly: opts?.subjectOnly ?? false,
          };

      const body = await adminApiJson<{
        success?: boolean;
        data?: {
          publishedCount?: number;
          parentsNotified?: number;
          notificationsQueued?: number;
          notifyReason?: string | null;
          message?: string;
        };
      }>("/api/teacher/results-publish", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const publishedCount = body.data?.publishedCount ?? 0;
      const parentsNotified = body.data?.parentsNotified ?? 0;
      toast.success(
        `Results published · ${publishedCount} records · ${parentsNotified} parents notified`,
      );
      if (parentsNotified === 0) {
        toast.message(
          body.data?.notifyReason ||
            "No linked parents found for those students. Link parents in admin first.",
        );
      } else if ((body.data?.notificationsQueued || 0) > 0) {
        toast.info(`${body.data?.notificationsQueued} notifications queued`);
      }
      void checkCompleteness();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Publish failed";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const selectedClassName =
    classes.find((c) => c.id === selectedClass)?.name || "";
  const selectedSubjectName =
    subjects.find((s) => s.id === selectedSubject)?.name || "";

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 px-5 py-6 text-white shadow-lg md:px-7 md:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/90">
              Classroom
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Exam Results</h1>
            <p className="mt-1.5 max-w-xl text-sm text-slate-300">
              Upload subject marks, preview matches, then publish — parents are
              notified automatically, same flow as roll call.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-100/80">
              Workflow
            </p>
            <p className="mt-1 font-medium text-white">Upload → Preview → Publish</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Upload className="h-5 w-5 text-sky-600" />
              Upload Subject Results
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Class
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Subject
                </label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="e.g. Mid-Term 1 2026"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Total Marks
                </label>
                <input
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(e.target.value)}
                  min="1"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Result Sheet (CSV or Excel)
              </label>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                  dragOver
                    ? "border-sky-400 bg-sky-50"
                    : "border-slate-300 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/50",
                )}
              >
                <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-400" />
                {file ? (
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {file.name}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-slate-600">
                      Drop file here or{" "}
                      <span className="font-medium text-sky-600">browse</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      CSV or Excel - columns: ExamNumber, Marks, Grade
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {previewLoading && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-sm text-slate-500">
                Parsing file and matching students…
              </span>
            </div>
          )}

          {showPreview && parsedRows && parsedRows.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-800">
                    Preview - {parsedRows.length} rows
                  </span>
                  <span className="text-sm text-emerald-600 font-medium">
                    {matchedCount} matched
                  </span>
                  {unmatchedCount > 0 && (
                    <span className="text-sm text-amber-600 font-medium">
                      {unmatchedCount} unmatched
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                    <tr>
                      <th className="px-5 py-2.5">Identifier</th>
                      <th className="px-3 py-2.5">Marks</th>
                      <th className="px-3 py-2.5">Grade</th>
                      <th className="px-5 py-2.5">Student</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="px-5 py-2 font-mono text-xs text-slate-800">
                          {row.identifier}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.marks ?? "-"}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {row.grade ?? "-"}
                        </td>
                        <td className="px-5 py-2">
                          {row.matchedStudent ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                              <UserCheck className="h-3 w-3" />
                              {row.matchedStudent}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                              <UserX className="h-3 w-3" />
                              No match
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 100 && (
                  <p className="border-t border-slate-100 px-5 py-2 text-center text-xs text-slate-400">
                    Showing 100 of {parsedRows.length} rows
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <div className="text-xs text-slate-500">
                  {students.length} students enrolled in {selectedClassName}
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploading || matchedCount === 0}
                  className={cn(
                    primaryButton("text-xs"),
                    "disabled:opacity-50",
                  )}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3.5 w-3.5" /> Upload {matchedCount}{" "}
                      Results
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {showPreview && parsedRows && parsedRows.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800">
                    No valid data found
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Could not find any rows with a student identifier
                    (ExamNumber, AdmissionNo, etc.) and valid marks. Check your
                    file format and try again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!showPreview && !previewLoading && (
            <button
              onClick={handleUpload}
              disabled={
                uploading ||
                !file ||
                !selectedClass ||
                !selectedSubject ||
                !examTitle.trim()
              }
              className={cn(primaryButton("w-full"), "disabled:opacity-50")}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload Results
                </>
              )}
            </button>
          )}

          {uploadResult && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Upload Complete
              </h3>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="text-emerald-700">
                  <span className="font-medium">Subject:</span>{" "}
                  {uploadResult.subjectName}
                </div>
                <div className="text-emerald-700">
                  <span className="font-medium">Class:</span>{" "}
                  {uploadResult.className}
                </div>
                <div className="text-emerald-700">
                  <span className="font-medium">Created:</span>{" "}
                  {uploadResult.resultsCreated}
                </div>
                <div className="text-emerald-700">
                  <span className="font-medium">Updated:</span>{" "}
                  {uploadResult.resultsUpdated}
                </div>
                {uploadResult.totalMatched > 0 && (
                  <div className="text-emerald-700">
                    <span className="font-medium">Matched:</span>{" "}
                    {uploadResult.totalMatched}
                  </div>
                )}
              </div>
              {uploadResult.unmatchedStudents &&
                uploadResult.unmatchedStudents.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-amber-700">
                      Unmatched ({uploadResult.unmatchedStudents.length}):
                    </p>
                    <p className="text-xs text-amber-600">
                      {uploadResult.unmatchedStudents.slice(0, 10).join(", ")}
                    </p>
                  </div>
                )}
              {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-amber-700">
                    Warnings:
                  </p>
                  {uploadResult.warnings.slice(0, 5).map((w, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      {w}
                    </p>
                  ))}
                </div>
              )}
              {uploadResult.assignmentId ? (
                <button
                  type="button"
                  onClick={() =>
                    void handlePublish({
                      assignmentId: uploadResult.assignmentId,
                      subjectOnly: true,
                    })
                  }
                  disabled={publishing}
                  className={cn(
                    primaryButton("mt-4 w-full"),
                    "disabled:opacity-50",
                  )}
                >
                  {publishing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Publish this subject to parents
                    </>
                  )}
                </button>
              ) : null}
            </div>
          )}

          {completeness && completeness.students.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Completeness</h3>
                <button
                  onClick={checkCompleteness}
                  className={secondaryButton("text-xs")}
                >
                  Refresh
                </button>
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <div>
                  <span className="font-bold text-emerald-600">
                    {completeness.summary.completeStudents}
                  </span>
                  <span className="text-slate-500">
                    /{completeness.summary.totalStudents} complete
                  </span>
                </div>
                <div>
                  <span className="font-bold text-sky-600">
                    {completeness.summary.uploadedSubjectCount}
                  </span>
                  <span className="text-slate-500">
                    /{completeness.summary.expectedSubjectCount} subjects
                  </span>
                </div>
              </div>
              <div className="mt-3 max-h-60 overflow-y-auto">
                {completeness.students.map((s) => (
                  <div
                    key={s.studentId}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                      s.isComplete
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-amber-200 bg-amber-50",
                    )}
                  >
                    <div>
                      <span className="font-medium text-slate-800">
                        {s.studentName}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {s.examNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-medium",
                          s.isComplete ? "text-emerald-700" : "text-amber-700",
                        )}
                      >
                        {s.uploadedSubjects}/{s.expectedSubjects}
                      </span>
                      {s.isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing}
                className={cn(
                  primaryButton("mt-4 w-full"),
                  "disabled:opacity-50",
                )}
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Publishing…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Publish to parents
                  </>
                )}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Releases your uploaded marks for this exam/class. Parents and
                students can view them immediately, and parents get a
                notification (like roll call).
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Quick Guide</h3>
            <ol className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  1
                </span>
                Select the class and subject
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  2
                </span>
                Enter exam title (e.g. Mid-Term 1 2026)
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  3
                </span>
                Upload CSV/Excel with columns: ExamNumber, Marks, Grade
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  4
                </span>
                Preview matched students before confirming
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  5
                </span>
                Repeat for each subject
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  6
                </span>
                Check completeness - certificates auto-generate when all
                subjects are uploaded
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
                  7
                </span>
                Publish — parents are notified automatically (same as roll call)
              </li>
            </ol>
          </div>

          {selectedClassName && examTitle.trim() && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="mb-2 font-semibold text-slate-900">
                Current Session
              </h3>
              <div className="space-y-1 text-sm text-slate-600">
                <div>
                  <span className="font-medium">Class:</span>{" "}
                  {selectedClassName}
                </div>
                <div>
                  <span className="font-medium">Exam:</span> {examTitle.trim()}
                </div>
                {selectedSubjectName && (
                  <div>
                    <span className="font-medium">Subject:</span>{" "}
                    {selectedSubjectName}
                  </div>
                )}
                <div>
                  <span className="font-medium">Students:</span>{" "}
                  {students.length} enrolled
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function pickFirst(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}
