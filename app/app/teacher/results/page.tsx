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
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { cn } from "@/lib/utils";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { adminApiFetch, adminApiJson } from "@/lib/admin-browser-api";
import { getECZGrade } from "@/lib/zambia-localization";
import {
  buildNoDataMessage,
  detectCsvDelimiter,
  parseResultsGrid,
  RESULTS_CSV_TEMPLATE,
} from "@/lib/results/sheet-parse";
import {
  buildStudentMatchIndex,
  matchSheetRowToStudent,
  type MatchableStudent,
} from "@/lib/results/match-students";

type Subject = { id: string; name: string; code: string | null };
type ClassItem = { id: string; name: string };

type ParsedRow = {
  identifier: string;
  classNumber: number | null;
  admissionNumber: string | null;
  name: string | null;
  marks: number | null;
  grade: string | null;
  matchedStudent: string | null;
  matchMethod: string | null;
  matchWarning: string | null;
  studentId: string | null;
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

type StudentLookup = MatchableStudent;

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
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewFilter, setPreviewFilter] = useState<"all" | "matched" | "unmatched">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('results-upload-preferences');
      if (saved) {
        const prefs = JSON.parse(saved);
        if (prefs.lastClassId) setSelectedClass(prefs.lastClassId);
        if (prefs.lastSubjectId) setSelectedSubject(prefs.lastSubjectId);
        if (prefs.lastExamTitle) setExamTitle(prefs.lastExamTitle);
        if (prefs.lastTotalMarks) setTotalMarks(prefs.lastTotalMarks);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save preferences when they change
  useEffect(() => {
    if (!selectedClass && !selectedSubject && !examTitle) return;
    
    try {
      localStorage.setItem('results-upload-preferences', JSON.stringify({
        lastClassId: selectedClass,
        lastSubjectId: selectedSubject,
        lastExamTitle: examTitle,
        lastTotalMarks: totalMarks,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [selectedClass, selectedSubject, examTitle, totalMarks]);

  const loadData = useCallback(async () => {
    try {
      // Subjects + students (class list comes from classHealth — not today's lessons)
      // Load all teaching subjects first; re-filter when a class is chosen.
      const [subjRes, studentsRes] = await Promise.all([
        adminApiJson("/api/teacher/subjects"),
        adminApiJson("/api/teacher/students"),
      ]);
      setSubjects(subjRes.data || []);

      const classHealth = (studentsRes.data?.classHealth || []) as Array<{
        id: string;
        name: string;
      }>;
      const fromHealth = classHealth.map((c) => ({
        id: c.id,
        name: c.name || "Class",
      }));

      // Fallback: derive classes from student rows
      const studentRows = (studentsRes.data?.students || []) as Array<{
        classId?: string;
        className?: string;
      }>;
      const fromStudents = new Map<string, string>();
      for (const s of studentRows) {
        if (s.classId && !fromStudents.has(s.classId)) {
          fromStudents.set(s.classId, s.className || "Class");
        }
      }
      const classList =
        fromHealth.length > 0
          ? fromHealth
          : Array.from(fromStudents.entries()).map(([id, name]) => ({
              id,
              name,
            }));

      setClasses(classList);
      if (classList.length === 1) setSelectedClass(classList[0].id);

      // Cache all students for matching once a class is chosen
      const allStudents: StudentLookup[] = studentRows.map((s: any) => ({
        id: s.id,
        classId: s.classId,
        classNumber:
          typeof s.classNumber === "number"
            ? s.classNumber
            : s.classNumber != null
              ? Number(s.classNumber)
              : null,
        admissionNumber: s.admissionNumber || null,
        displayName: s.displayName || "Student",
      }));
      // Store unfiltered; filter by selected class in useMemo
      setStudents(allStudents);
    } catch {
      toast.error("Failed to load data");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When a class is selected, load subjects scoped to that class so the
  // dropdown matches the teacher's real teaching assignment (not only timetable).
  useEffect(() => {
    if (!selectedClass) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminApiJson(
          `/api/teacher/subjects?classId=${encodeURIComponent(selectedClass)}`,
        );
        if (cancelled) return;
        const next = (res.data || []) as Subject[];
        setSubjects(next);
        setSelectedSubject((prev) =>
          prev && next.some((s) => s.id === prev) ? prev : "",
        );
      } catch {
        // Keep previously loaded subjects if class-scoped fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedClass]);

  const studentsInClass = useMemo(
    () =>
      selectedClass
        ? students.filter((s) => s.classId === selectedClass)
        : [],
    [students, selectedClass],
  );

  const matchIndex = useMemo(
    () => buildStudentMatchIndex(studentsInClass),
    [studentsInClass],
  );

  const [parseDiagnostics, setParseDiagnostics] = useState<string | null>(null);
  const [rawSample, setRawSample] = useState<string[][] | null>(null);

  const parseFile = useCallback(
    async (f: File) => {
      setPreviewLoading(true);
      setParsedRows(null);
      setShowPreview(false);
      setParseDiagnostics(null);
      setRawSample(null);

      try {
        const name = f.name.toLowerCase();
        let grid: string[][] = [];

        if (name.endsWith(".csv") || name.endsWith(".txt")) {
          const text = await f.text();
          const delimiter = detectCsvDelimiter(text);
          // Dynamic import keeps papaparse out of the initial page bundle.
          const PapaModule = await import("papaparse");
          const Papa = (PapaModule.default ?? PapaModule) as typeof PapaModule;
          const gridResult = Papa.parse<string[]>(text, {
            header: false,
            skipEmptyLines: "greedy",
            delimiter,
          });
          if (
            gridResult.errors.length > 0 &&
            (!gridResult.data || gridResult.data.length === 0)
          ) {
            const e = gridResult.errors[0];
            throw new Error(`CSV error at row ${e.row}: ${e.message}`);
          }
          grid = (gridResult.data || []).map((line) =>
            (Array.isArray(line) ? line : [String(line ?? "")]).map((c) =>
              String(c ?? "").trim(),
            ),
          );
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const XLSX = await import("xlsx");
          const buffer = await f.arrayBuffer();
          const wb = XLSX.read(buffer, { type: "array", cellDates: false });
          // Prefer the sheet with the most non-empty rows
          let bestGrid: string[][] = [];
          for (const sheetName of wb.SheetNames) {
            const ws = wb.Sheets[sheetName];
            if (!ws) continue;
            const data = XLSX.utils.sheet_to_json<string[]>(ws, {
              header: 1,
              defval: "",
              raw: false,
              blankrows: false,
            }) as string[][];
            const candidate = data.map((line) =>
              (line || []).map((c) => String(c ?? "").trim()),
            );
            const filled = candidate.filter((r) => r.some(Boolean)).length;
            const bestFilled = bestGrid.filter((r) => r.some(Boolean)).length;
            if (filled > bestFilled) bestGrid = candidate;
          }
          grid = bestGrid;
          if (grid.filter((r) => r.some(Boolean)).length < 1) {
            throw new Error("Excel file has no data rows on any sheet");
          }
        } else {
          throw new Error(
            "Unsupported file format. Use CSV or Excel (.xlsx/.xls).",
          );
        }

        const total = Number(totalMarks) || 100;
        const sheet = parseResultsGrid(grid, { totalMarks: total });
        setRawSample(sheet.sampleRows || grid.slice(0, 5));

        if (sheet.rows.length === 0) {
          const msg = buildNoDataMessage(sheet);
          setParseDiagnostics(msg);
          setParsedRows([]);
          setShowPreview(true);
          toast.error("Could not read rows from this file — see details below");
          return;
        }

        const parsed: ParsedRow[] = sheet.rows.map((row) => {
          let grade = row.grade;
          if (!grade && row.marks !== null) {
            try {
              const scale = getECZGrade(row.marks);
              grade = `${scale.grade} (${scale.label})`;
            } catch {
              /* ignore */
            }
          }

          const match = selectedClass
            ? matchSheetRowToStudent(
                {
                  classNumber: row.classNumber,
                  admissionNumber: row.admissionNumber,
                  name: row.name,
                  identifier: row.identifier,
                },
                matchIndex,
              )
            : {
                student: null,
                method: "none" as const,
                ambiguous: false,
                reason: "Select a class to match students",
              };

          return {
            identifier: row.identifier.trim(),
            classNumber: row.classNumber,
            admissionNumber: row.admissionNumber,
            name: row.name,
            marks: row.marks,
            grade,
            matchedStudent: match.student?.displayName || null,
            matchMethod: match.method === "none" ? null : match.method,
            matchWarning: match.reason || null,
            studentId: match.student?.id || null,
          };
        });

        setParsedRows(parsed);
        setShowPreview(true);
        const matchedN = parsed.filter((r) => r.studentId).length;
        setParseDiagnostics(
          `Read ${parsed.length} row(s) · ${matchedN} matched in class. Columns: ${[
            sheet.foundClassNumberColumn,
            sheet.foundStudentIdColumn,
            sheet.foundNameColumn,
            sheet.foundMarksColumn || "marks",
          ]
            .filter(Boolean)
            .join(", ")}` +
            (!selectedClass
              ? " — select a class to match Class Number / Name."
              : ""),
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to parse file";
        toast.error(msg);
        setParseDiagnostics(msg);
        setParsedRows([]);
        setShowPreview(true);
      } finally {
        setPreviewLoading(false);
      }
    },
    [matchIndex, selectedClass, totalMarks],
  );

  useEffect(() => {
    // Re-parse when file changes or class changes (class needed for matching).
    if (file) {
      void parseFile(file);
    } else {
      setParsedRows(null);
      setShowPreview(false);
      setParseDiagnostics(null);
      setRawSample(null);
    }
  }, [file, selectedClass, parseFile]);

  const downloadTemplate = () => {
    const blob = new Blob([RESULTS_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchedCount = useMemo(
    () => parsedRows?.filter((r) => r.studentId).length ?? 0,
    [parsedRows],
  );
  const unmatchedCount = useMemo(
    () => parsedRows?.filter((r) => !r.studentId).length ?? 0,
    [parsedRows],
  );

  const displayRows = useMemo(() => {
    if (!parsedRows) return [];
    let list = parsedRows;
    if (previewFilter === "matched") {
      list = list.filter((r) => r.studentId);
    } else if (previewFilter === "unmatched") {
      list = list.filter((r) => !r.studentId);
    }
    if (previewSearch.trim()) {
      const q = previewSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.identifier && r.identifier.toLowerCase().includes(q)) ||
          (r.admissionNumber && r.admissionNumber.toLowerCase().includes(q)) ||
          (r.matchedStudent && r.matchedStudent.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [parsedRows, previewFilter, previewSearch]);

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

      // Prefer same-origin /api for multipart (gateway must forward binary as-is).
      // adminApiFetch still works; gateway now streams ArrayBuffer for form-data.
      const res = await adminApiFetch("/api/teacher/results-upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg =
          body?.error ||
          (res.status === 503
            ? "Server temporarily unavailable for uploads. Try again in a moment."
            : `Upload failed (${res.status})`);
        toast.error(msg);
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

  // Parent link health for selected class
  const parentLinkHealth = useMemo(() => {
    if (!selectedClass) return null;
    
    const studentsInSelectedClass = students.filter(
      (s) => s.classId === selectedClass,
    );
    
    // Count students with profile_id (potential for parent linking)
    const linkedCount = studentsInSelectedClass.filter(
      (s) => s.admissionNumber && s.displayName,
    ).length;
    
    return {
      totalStudents: studentsInSelectedClass.length,
      hasProfiles: linkedCount,
      hasAnyLinked: linkedCount > 0,
    };
  }, [students, selectedClass]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <AdminPageHero
        eyebrow="Classroom"
        title="Exam Results"
        description="Upload and verify subject marks, match student rosters, and publish official continuous assessment or exam scores to parents."
        stats={[
          {
            label: "Classes",
            value: classes.length,
            hint: "In your teaching scope",
            tone: "slate",
          },
          {
            label: "Subjects",
            value: subjects.length,
            hint: selectedClass ? "For selected class" : "Assigned",
            tone: "slate",
          },
          {
            label: "Enrolled",
            value: students.length,
            hint: "Total students",
            tone: "slate",
          },
          {
            label: "Workflow",
            value: "4 steps",
            hint: "Upload → Preview → Publish",
            tone: "emerald",
          },
        ]}
        accent="slate"
      />

      {/* 4-Step Workflow Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          {
            step: "1",
            title: "Select Class & Subject",
            done: !!(selectedClass && selectedSubject),
          },
          {
            step: "2",
            title: "Choose Sheet / CSV",
            done: !!file,
          },
          {
            step: "3",
            title: "Match & Preview",
            done: !!(uploadResult || (parsedRows && matchedCount > 0)),
          },
          {
            step: "4",
            title: "Publish to Parents",
            done: !!(uploadResult?.assignmentId),
          },
        ].map((item) => (
          <div
            key={item.step}
            className={cn(
              "flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-xs transition duration-150",
              item.done
                ? "border-emerald-200 bg-emerald-50/70 text-emerald-900 font-semibold"
                : "border-slate-200 bg-white text-slate-500",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                item.done
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-600",
              )}
            >
              {item.done ? "✓" : item.step}
            </span>
            <span className="truncate">{item.title}</span>
          </div>
        ))}
      </div>

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
                  disabled={subjects.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">
                    {subjects.length === 0
                      ? selectedClass
                        ? "No subjects assigned for this class"
                        : "Select a class first"
                      : "Select subject"}
                  </option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ""}
                    </option>
                  ))}
                </select>
                {subjects.length === 0 ? (
                  <p className="mt-1.5 text-xs text-amber-700">
                    Ask the Head Teacher or Registrar to assign you to this
                    class and subject under staff teaching assignments.
                  </p>
                ) : null}
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
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700">
                  Result Sheet (CSV or Excel)
                </label>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download template
                </button>
              </div>
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
                      Prefer: Class Number, Name, Marks — avoids duplicate-name
                      mix-ups
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
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                    Preview ({parsedRows.length})
                  </span>
                  <div className="flex items-center gap-1">
                    {(["all", "matched", "unmatched"] as const).map((filterKey) => {
                      const count =
                        filterKey === "all"
                          ? parsedRows.length
                          : filterKey === "matched"
                            ? matchedCount
                            : unmatchedCount;
                      const active = previewFilter === filterKey;
                      return (
                        <button
                          key={filterKey}
                          type="button"
                          onClick={() => setPreviewFilter(filterKey)}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition",
                            active
                              ? "bg-slate-900 text-white shadow-sm"
                              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                          )}
                        >
                          {filterKey === "all"
                            ? "All"
                            : filterKey === "matched"
                              ? "Matched"
                              : "Unmatched"}{" "}
                          <span className="opacity-75">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[12rem]">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      placeholder="Filter preview…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-1 pl-8 pr-3 text-xs outline-none focus:border-slate-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreview(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    title="Close preview"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/90 sticky top-0 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5">#</th>
                      <th className="px-4 py-2.5">Name / Identifier</th>
                      <th className="px-4 py-2.5">Marks</th>
                      <th className="px-4 py-2.5">Grade</th>
                      <th className="px-4 py-2.5">Matched Student</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          No students match this preview filter.
                        </td>
                      </tr>
                    ) : (
                      displayRows.slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-2 font-mono text-[11px] font-bold text-slate-700">
                            {row.classNumber ?? i + 1}
                          </td>
                          <td className="px-4 py-2 text-slate-800">
                            <div className="font-semibold">
                              {row.name || row.identifier}
                            </div>
                            {row.admissionNumber ? (
                              <div className="font-mono text-[10px] text-slate-400">
                                {row.admissionNumber}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 font-medium text-slate-700">
                            {row.marks ?? "—"}
                          </td>
                          <td className="px-4 py-2">
                            {row.grade ? (
                              <span className="inline-flex rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                                {row.grade}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {row.matchedStudent ? (
                              <span className="inline-flex flex-col gap-0.5 text-xs text-emerald-700">
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                                  {row.matchedStudent}
                                </span>
                                {row.matchMethod ? (
                                  <span className="text-[10px] text-emerald-600/80">
                                    via {row.matchMethod.replace("_", " ")}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="inline-flex flex-col gap-0.5 text-xs text-amber-700">
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <UserX className="h-3.5 w-3.5 text-amber-600" />
                                  No match
                                </span>
                                {row.matchWarning ? (
                                  <span className="text-[10px] text-amber-800">
                                    {row.matchWarning}
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                {displayRows.length > 100 && (
                  <p className="border-t border-slate-100 px-5 py-2 text-center text-xs text-slate-400">
                    Showing first 100 of {displayRows.length} rows
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                <div className="text-xs text-slate-500">
                  {studentsInClass.length} students enrolled in{" "}
                  {selectedClassName || "selected class"}
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
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-amber-800">
                    Could not read this file
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    {parseDiagnostics ||
                      "No student rows found. Use Admission No (or Name) and Marks columns."}
                  </p>
                  {rawSample && rawSample.length > 0 && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white/80 p-2">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800/80">
                        What we saw in your file
                      </p>
                      <table className="w-full text-left text-xs text-slate-700">
                        <tbody>
                          {rawSample.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-slate-100 first:border-0">
                              <td className="py-1 pr-2 font-mono text-slate-400">
                                {i + 1}
                              </td>
                              <td className="py-1 font-mono">
                                {row.filter(Boolean).slice(0, 6).join(" · ") ||
                                  "(empty row)"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className={secondaryButton("text-xs")}
                    >
                      <Download className="h-3.5 w-3.5" /> Download CSV template
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-amber-700/90">
                    Hard-refresh (Ctrl+Shift+R) if the UI looks outdated, then
                    use the template: Class Number, Name, Marks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showPreview &&
            parsedRows &&
            parsedRows.length > 0 &&
            parseDiagnostics && (
              <p className="text-xs text-slate-500">{parseDiagnostics}</p>
            )}

          <div
            role="status"
            aria-live="polite"
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              !file || !selectedClass || !selectedSubject || !examTitle.trim()
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : previewLoading
                  ? "border-sky-200 bg-sky-50 text-sky-800"
                  : parsedRows && matchedCount > 0 && unmatchedCount === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : parsedRows && matchedCount > 0
                      ? "border-amber-200 bg-amber-50 text-amber-900"
                      : "border-slate-200 bg-white text-slate-600",
            )}
          >
            <div className="flex items-start gap-3">
              {previewLoading ? (
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              ) : parsedRows && matchedCount > 0 && unmatchedCount === 0 ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : parsedRows && unmatchedCount > 0 ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-semibold">
                  {!selectedClass
                    ? "Select a class to begin"
                    : !selectedSubject
                      ? "Select a subject to continue"
                      : !examTitle.trim()
                        ? "Add an exam title to continue"
                        : !file
                          ? "Choose a CSV or Excel file"
                          : previewLoading
                            ? "Checking your file…"
                            : parsedRows && matchedCount > 0 && unmatchedCount === 0
                              ? "Ready to upload"
                              : parsedRows && matchedCount > 0
                                ? `${matchedCount} matched · ${unmatchedCount} row${unmatchedCount === 1 ? " needs" : "s need"} review`
                                : "Preview the file to check student matches"}
                </p>
                {parsedRows && matchedCount > 0 ? (
                  <p className="mt-0.5 text-xs opacity-80">
                    {matchedCount} result{matchedCount === 1 ? "" : "s"} will be uploaded
                    {unmatchedCount > 0 ? ` · ${unmatchedCount} unmatched rows will be skipped` : ""}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {!showPreview && !previewLoading && (
            <button
              onClick={handleUpload}
              disabled={
                uploading ||
                previewLoading ||
                matchedCount === 0 ||
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
                Upload CSV/Excel with Class Number, Name, and Marks
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
                  {studentsInClass.length} enrolled
                </div>
                {/* Parent link health */}
                {parentLinkHealth && (
                  <div className="mt-2 rounded-lg border border-dashed px-3 py-2 text-xs">
                    {parentLinkHealth.hasAnyLinked ? (
                      <span className="text-emerald-700">
                        ✓ Parents can be notified for{" "}
                        {parentLinkHealth.hasProfiles} students
                      </span>
                    ) : (
                      <span className="flex items-start gap-1.5 text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        No parents linked yet — link in admin first
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


