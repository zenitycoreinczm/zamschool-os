import { NextRequest, NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage, getClientIp, applyRateLimit } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditDomainWrite } from "@/lib/audit-domain";
import { getECZGrade } from "@/lib/zambia-localization";
import {
  buildNoDataMessage,
  detectCsvDelimiter,
  parseResultsGrid,
} from "@/lib/results/sheet-parse";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    // Apply rate limiting
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-results-upload:${userId}:${ip}`,
      limit: 20,
      windowMs: 60_000, // 20 requests per minute
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        }
      );
    }

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: access.context.profileId || userId,
    });
    if (assignmentScope.actorTeacherIds.length === 0 || assignmentScope.allowedClassIds.length === 0) {
      return NextResponse.json({ error: "No assigned teaching scope found" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subjectId = formData.get("subjectId") as string | null;
    const examTitle = formData.get("examTitle") as string | null;
    const totalMarksRaw = formData.get("totalMarks") as string | null;
    const classId = formData.get("classId") as string | null;

    if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` },
        { status: 400 }
      );
    }
    if (!subjectId) return NextResponse.json({ error: "Subject ID is required" }, { status: 400 });
    if (!examTitle?.trim()) return NextResponse.json({ error: "Exam title is required" }, { status: 400 });
    if (!classId) return NextResponse.json({ error: "Class ID is required" }, { status: 400 });

    if (!assignmentScope.allowedClassIds.includes(classId)) {
      return NextResponse.json({ error: "You are not assigned to this class" }, { status: 403 });
    }

    const totalMarks = totalMarksRaw ? Number(totalMarksRaw) : 100;
    if (isNaN(totalMarks) || totalMarks <= 0) {
      return NextResponse.json({ error: "Total marks must be a positive number" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const [{ data: subject, error: subjectError }, { data: classRow, error: classError }] = await Promise.all([
      supabaseAdmin.from("subjects").select("id, name, code").eq("id", subjectId).eq("school_id", schoolId).maybeSingle(),
      supabaseAdmin.from("classes").select("id, name").eq("id", classId).eq("school_id", schoolId).maybeSingle(),
    ]);

    if (subjectError) throw subjectError;
    if (classError) throw classError;
    if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    if (!classRow) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();

    let grid: string[][];
    try {
      if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        grid = await parseCsvGrid(buffer);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        grid = parseExcelGrid(buffer);
      } else {
        return NextResponse.json(
          { error: "Unsupported format. Upload CSV or Excel (.xlsx/.xls) files." },
          { status: 400 }
        );
      }
    } catch (parseError: unknown) {
      return NextResponse.json(
        {
          error:
            parseError instanceof Error
              ? parseError.message
              : "Failed to parse file",
        },
        { status: 400 },
      );
    }

    const sheet = parseResultsGrid(grid, { totalMarks });
    if (sheet.rows.length === 0) {
      return NextResponse.json(
        {
          error: buildNoDataMessage(sheet),
          foundColumns: sheet.headers.slice(0, 20),
          sampleRows: sheet.sampleRows?.slice(0, 5),
          warnings: sheet.warnings.slice(0, 20),
        },
        { status: 400 },
      );
    }

    const { data: gradingScales } = await supabaseAdmin
      .from("grading_scales")
      .select("min_score, max_score, grade")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: true });

    interface ParsedRow {
      identifier: string;
      marks: number | null;
      grade: string | null;
    }

    const warnings: string[] = [...sheet.warnings];
    const parsed: ParsedRow[] = sheet.rows.map((row) => ({
      identifier: row.identifier.trim(),
      marks: row.marks,
      grade: row.grade || computeGrade(row.marks, gradingScales || []),
    }));

    const studentIdByIdentifier = await resolveStudentIds(schoolId, classId, parsed);

    const unmatched: string[] = [];
    const resultsPayload: {
      student_id: string;
      assignment_id: string;
      exam_id: string | null;
      score: number | null;
      grade: string | null;
      school_id: string;
    }[] = [];

    for (const row of parsed) {
      const key = row.identifier.toLowerCase().trim();
      const studentId =
        studentIdByIdentifier.get(key) ||
        studentIdByIdentifier.get(key.replace(/[\s_-]/g, ""));
      if (!studentId) {
        unmatched.push(row.identifier);
        continue;
      }
      resultsPayload.push({
        student_id: studentId,
        assignment_id: "", // filled after assignment is resolved
        exam_id: null,
        score: row.marks,
        grade: row.grade,
        school_id: schoolId,
      });
    }

    if (resultsPayload.length === 0) {
      return NextResponse.json({
        error: `No students matched. Check exam numbers. Unmatched: ${unmatched.slice(0, 10).join(", ")}`,
        unmatchedStudents: unmatched,
      }, { status: 400 });
    }

    // ── ATOMIC assignment upsert ──────────────────────────────────────────────
    const teacherId = assignmentScope.actorTeacherIds[0];
    let assignmentId: string;

    try {
      const { data: assignment, error: assignError } = await supabaseAdmin
        .from("assignments")
        .upsert({
          school_id: schoolId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          title: examTitle.trim(),
          total_marks: totalMarks,
        }, {
          onConflict: "school_id,class_id,subject_id,title",
          ignoreDuplicates: false,
        })
        .select("id")
        .single();

      if (assignError) throw assignError;
      assignmentId = assignment.id;
    } catch (assignError: unknown) {
      // If the unique constraint doesn't exist yet, fall back to check-then-insert
      assignmentId = await fallbackCreateAssignment(schoolId, classId, subjectId, teacherId, examTitle.trim(), totalMarks);
    }

    // ── PUBLISH LOCK CHECK ────────────────────────────────────────────────────
    const { data: publishedResults } = await supabaseAdmin
      .from("results")
      .select("id, student_id")
      .eq("assignment_id", assignmentId)
      .not("published_at", "is", null);

    if (publishedResults && publishedResults.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot overwrite published results. ${publishedResults.length} result(s) for this assignment have already been published. Ask an administrator to unpublish first if corrections are needed.`,
          publishedCount: publishedResults.length,
          locked: true,
        },
        { status: 409 }
      );
    }

    // ── ATOMIC exam upsert ─────────────────────────────────────────────────────
    let examId: string | null = null;
    try {
      const { data: exam, error: examError } = await supabaseAdmin
        .from("exams")
        .upsert({
          school_id: schoolId,
          class_id: classId,
          subject_id: subjectId,
          title: examTitle.trim(),
          name: examTitle.trim(),
        }, {
          onConflict: "school_id,class_id,subject_id,title",
          ignoreDuplicates: false,
        })
        .select("id")
        .maybeSingle();

      if (examError && !isMissingTableError(examError)) throw examError;
      examId = exam?.id || null;
    } catch {
      examId = null;
    }

    // ── ATOMIC results upsert ─────────────────────────────────────────────────
    for (const row of resultsPayload) {
      row.assignment_id = assignmentId;
      row.exam_id = examId;
    }

    // ── ANOMALY DETECTION: fetch existing marks before upsert ────────────────
    const existingStudentIds = resultsPayload.map((r) => r.student_id);
    const { data: existingResults } = await supabaseAdmin
      .from("results")
      .select("student_id, score")
      .eq("school_id", schoolId)
      .eq("assignment_id", assignmentId)
      .in("student_id", existingStudentIds);

    const existingScoreByStudent = new Map<string, number>();
    for (const r of existingResults || []) {
      if (r.score != null) {
        existingScoreByStudent.set(r.student_id, Number(r.score));
      }
    }

    let resultsCreated = 0;
    let resultsUpdated = 0;
    const previouslyExistingStudentIds = new Set(existingScoreByStudent.keys());
    // Also treat any pre-existing row (even score null) as update if we know it.
    if (existingResults) {
      for (const r of existingResults) {
        if (r.student_id) previouslyExistingStudentIds.add(r.student_id);
      }
    }

    try {
      const schoolScopedResultsPayload = resultsPayload.map((row) => ({
        ...row,
        school_id: schoolId,
      }));
      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from("results")
        .upsert(schoolScopedResultsPayload, {
          onConflict: "student_id,assignment_id",
          ignoreDuplicates: false,
        })
        .select("id, student_id");

      if (upsertError) throw upsertError;

      for (const row of upserted || []) {
        if (previouslyExistingStudentIds.has(row.student_id)) {
          resultsUpdated++;
        } else {
          resultsCreated++;
        }
      }
      // If select returns fewer rows than payload (some drivers), derive counts.
      if ((upserted || []).length === 0 && resultsPayload.length > 0) {
        for (const row of resultsPayload) {
          if (previouslyExistingStudentIds.has(row.student_id)) {
            resultsUpdated++;
          } else {
            resultsCreated++;
          }
        }
      }
    } catch (resultError: unknown) {
      // If the unique constraint doesn't exist, fall back to individual upserts
      const result = await fallbackUpsertResults(schoolId, resultsPayload);
      resultsCreated = result.created;
      resultsUpdated = result.updated;
    }

    // ── ANOMALY DETECTION ─────────────────────────────────────────────────────
    const anomalies: Array<{ studentId: string; oldScore: number; newScore: number; changePercent: number }> = [];
    const ANOMALY_THRESHOLD = 20; // percent

    for (const row of resultsPayload) {
      const oldScore = existingScoreByStudent.get(row.student_id);
      if (oldScore != null && row.score != null && oldScore > 0) {
        const changePercent = Math.abs(((row.score - oldScore) / oldScore) * 100);
        if (changePercent > ANOMALY_THRESHOLD) {
          anomalies.push({
            studentId: row.student_id,
            oldScore,
            newScore: row.score,
            changePercent: Math.round(changePercent),
          });
        }
      }
    }

    // ── AUDIT LOG ──────────────────────────────────────────────────────────────
    await auditDomainWrite({
      schoolId,
      userId,
      action: "results.uploaded",
      entityType: "results",
      entityId: assignmentId,
      newData: {
        subjectName: subject.name,
        className: classRow.name,
        examTitle: examTitle.trim(),
        totalMarks,
        resultsCreated,
        resultsUpdated,
        totalMatched: resultsPayload.length,
        unmatchedCount: unmatched.length,
        anomalyCount: anomalies.length,
      },
      ipAddress: getClientIp(req),
    });

    // ── Response ──────────────────────────────────────────────────────────────
    const response = NextResponse.json({
      success: true,
      data: {
        assignmentId,
        subjectId,
        classId,
        subjectName: subject.name,
        subjectCode: subject.code,
        className: classRow.name,
        examTitle: examTitle.trim(),
        totalMarks,
        resultsCreated,
        resultsUpdated,
        totalMatched: resultsPayload.length,
        unmatchedStudents: unmatched,
        warnings: warnings.slice(0, 20),
        anomalies: anomalies.length > 0 ? anomalies.slice(0, 10) : undefined,
        anomalyCount: anomalies.length,
      },
    });

    return applyEdgeCacheHeaders(response, "noStore");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to upload results") },
      { status: 500 }
    );
  }
}

async function fallbackCreateAssignment(
  schoolId: string, classId: string, subjectId: string,
  teacherId: string, title: string, totalMarks: number,
  retries = 3,
): Promise<string> {
  const supabaseAdmin = getSupabaseAdmin();
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data: existing } = await supabaseAdmin
      .from("assignments")
      .select("id")
      .eq("school_id", schoolId)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .eq("title", title)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await supabaseAdmin
      .from("assignments")
      .insert({
        school_id: schoolId, class_id: classId, subject_id: subjectId,
        teacher_id: teacherId, title, total_marks: totalMarks,
      })
      .select("id")
      .maybeSingle();

    if (created) return created.id;

    // Unique violation - another teacher created it concurrently, retry
    if (error && (error.code === "23505" || error.message?.includes("unique"))) {
      continue;
    }
    throw error || new Error("Failed to create assignment");
  }
  throw new Error("Could not create assignment after retries - concurrent conflict");
}

async function fallbackUpsertResults(
  schoolId: string,
  rows: { student_id: string; assignment_id: string; exam_id: string | null; score: number | null; grade: string | null; school_id: string }[],
): Promise<{ created: number; updated: number }> {
  const supabaseAdmin = getSupabaseAdmin();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing } = await supabaseAdmin
      .from("results")
      .select("id")
      .eq("school_id", schoolId)
      .eq("student_id", row.student_id)
      .eq("assignment_id", row.assignment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("results")
        .update({ score: row.score, grade: row.grade, exam_id: row.exam_id })
        .eq("school_id", schoolId)
        .eq("id", existing.id);
      if (error) throw error;
      updated++;
    } else {
      const { error } = await supabaseAdmin
        .from("results")
        .insert(row);
      if (error) {
        // Unique violation - row was inserted concurrently, treat as update
        if (error.code === "23505" || error.message?.includes("unique")) {
          updated++;
          continue;
        }
        throw error;
      }
      created++;
    }
  }

  return { created, updated };
}

function computeGrade(
  marks: number | null,
  scales: Array<{ min_score: number; max_score: number; grade: string }>,
): string | null {
  if (marks == null) return null;
  for (const scale of scales) {
    if (marks >= scale.min_score && marks <= scale.max_score) {
      return scale.grade;
    }
  }
  try {
    const ecz = getECZGrade(marks);
    return ecz.grade;
  } catch {
    return null;
  }
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  const message = String(error?.message || "");
  return error?.code === "42P01" || message.includes("does not exist") || message.includes("schema cache");
}

async function parseCsvGrid(buffer: Buffer): Promise<string[][]> {
  const Papa = await import("papaparse");
  const text = buffer.toString("utf-8");
  const delimiter = detectCsvDelimiter(text);
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter,
  });
  if (result.errors.length > 0 && (!result.data || result.data.length === 0)) {
    const e = result.errors[0];
    throw new Error(`CSV error at row ${e.row}: ${e.message}`);
  }
  return (result.data || []).map((line) =>
    (Array.isArray(line) ? line : [line]).map((c) => String(c ?? "").trim()),
  );
}

function parseExcelGrid(buffer: Buffer): string[][] {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  let best: string[][] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as string[][];
    const grid = data.map((line) =>
      (line || []).map((c) => String(c ?? "").trim()),
    );
    const filled = grid.filter((r) => r.some(Boolean)).length;
    if (filled > best.filter((r) => r.some(Boolean)).length) {
      best = grid;
    }
  }
  if (best.filter((r) => r.some(Boolean)).length < 1) {
    throw new Error("Excel file has no data rows on any sheet");
  }
  return best;
}

async function resolveStudentIds(
  schoolId: string,
  classId: string,
  _rows: { identifier: string }[],
): Promise<Map<string, string>> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, student_number, class_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId);

  if (error) throw error;

  const result = new Map<string, string>();

  const indexKey = (value: string, studentId: string) => {
    const key = String(value || "")
      .toLowerCase()
      .trim();
    if (!key) return;
    result.set(key, studentId);
    result.set(key.replace(/[\s_-]/g, ""), studentId);
  };

  for (const s of students || []) {
    if (s.student_number) indexKey(s.student_number, s.id);
    if (s.profile_id) indexKey(s.profile_id, s.id);
    indexKey(s.id, s.id);
  }

  if (students && students.length > 0) {
    const profileIds = Array.from(
      new Set(students.map((s: any) => s.profile_id).filter(Boolean)),
    );
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("school_id", schoolId)
        .in("id", profileIds);

      const studentIdByProfile = new Map(
        (students || [])
          .filter((s: any) => s.profile_id)
          .map((s: any) => [String(s.profile_id), String(s.id)]),
      );

      for (const p of profiles || []) {
        const studentId = studentIdByProfile.get(String(p.id));
        if (!studentId) continue;
        if (p.email) indexKey(p.email, studentId);
        const fullName = [p.first_name, p.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (fullName) indexKey(fullName, studentId);
      }
    }
  }

  return result;
}
