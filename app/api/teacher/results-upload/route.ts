import { NextRequest, NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage, getClientIp, applyRateLimit } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { auditDomainWrite } from "@/lib/audit-domain";
import { getECZGrade } from "@/lib/zambia-localization";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const STUDENT_ID_COL_KEYS = [
  "exam_number", "exam no", "examno",
  "admission_number", "admission no",
  "student_number",
  "student_id", "id",
  "registration", "reg_no",
];
const MARKS_COL_KEYS = ["marks", "mark", "score", "points", "total", "raw_marks"];
const GRADE_COL_KEYS = ["grade", "letter", "grade_letter", "letter_grade", "grade_letter"];

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
      schoolId, actorProfileId: userId,
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

    let rows: Record<string, string>[];
    if (fileName.endsWith(".csv")) {
      rows = await parseCsv(buffer);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      rows = parseExcel(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported format. Upload CSV or Excel (.xlsx/.xls) files." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data rows found in file" }, { status: 400 });
    }

    // ── COLUMN VALIDATION ─────────────────────────────────────────────────────
    const headers = Object.keys(rows[0] || {});
    const normalizedHeaders = headers.map(normalizeHeader);
    const hasStudentIdCol = STUDENT_ID_COL_KEYS.some((key) =>
      normalizedHeaders.includes(key)
    );
    const hasMarksCol = MARKS_COL_KEYS.some((key) =>
      normalizedHeaders.includes(key)
    );
    const hasGradeCol = GRADE_COL_KEYS.some((key) =>
      normalizedHeaders.includes(key)
    );

    if (!hasStudentIdCol) {
      return NextResponse.json(
        {
          error: `Missing student identifier column. Expected one of: ${STUDENT_ID_COL_KEYS.slice(0, 5).join(", ")}, etc.`,
          foundColumns: headers.slice(0, 20),
        },
        { status: 400 }
      );
    }

    if (!hasMarksCol && !hasGradeCol) {
      return NextResponse.json(
        {
          error: `Missing marks/grade columns. Expected at least one of: ${MARKS_COL_KEYS.slice(0, 5).join(", ")} or ${GRADE_COL_KEYS.slice(0, 3).join(", ")}`,
          foundColumns: headers.slice(0, 20),
        },
        { status: 400 }
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

    const parsed: ParsedRow[] = [];
    const warnings: string[] = [];

    for (const [index, row] of rows.entries()) {
      const identifier = pickFirst(row, STUDENT_ID_COL_KEYS);
      if (!identifier.trim()) {
        warnings.push(`Row ${index + 1}: No student identifier found - skipped. Required columns: ${STUDENT_ID_COL_KEYS.slice(0, 5).join(", ")}, etc.`);
        continue;
      }

      const rawMarks = pickFirst(row, MARKS_COL_KEYS);
      let marks: number | null = null;
      if (rawMarks.trim()) {
        marks = Number(rawMarks);
        if (isNaN(marks)) {
          warnings.push(`Row ${index + 1}: "${rawMarks}" is not a valid number - skipped`);
          continue;
        }
        if (marks < 0 || marks > totalMarks) {
          warnings.push(`Row ${index + 1}: marks ${marks} out of range 0–${totalMarks} - clamped`);
          marks = Math.max(0, Math.min(totalMarks, marks));
        }
      }

      const grade = pickFirst(row, GRADE_COL_KEYS) || computeGrade(marks, gradingScales || []);

      parsed.push({
        identifier: identifier.trim(),
        marks,
        grade: grade || null,
      });
    }

    if (parsed.length === 0) {
      return NextResponse.json({
        error: "No valid student rows found. Every row was missing a student identifier or had invalid marks.",
        warnings: warnings.slice(0, 20),
      }, { status: 400 });
    }

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
      const studentId = studentIdByIdentifier.get(row.identifier.toLowerCase());
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

    try {
      const { data: upserted, error: upsertError } = await supabaseAdmin
        .from("results")
        .upsert(resultsPayload, {
          onConflict: "student_id,assignment_id",
          ignoreDuplicates: false,
        })
        .select("id, student_id");

      if (upsertError) throw upsertError;

      const existingIds = new Set(
        (resultsPayload).map((r) => r.student_id)
      );

      for (const row of upserted || []) {
        if (existingIds.has(row.student_id)) {
          resultsUpdated++;
        } else {
          resultsCreated++;
        }
      }
    } catch (resultError: unknown) {
      // If the unique constraint doesn't exist, fall back to individual upserts
      const result = await fallbackUpsertResults(resultsPayload);
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
  rows: { student_id: string; assignment_id: string; exam_id: string | null; score: number | null; grade: string | null; school_id: string }[],
): Promise<{ created: number; updated: number }> {
  const supabaseAdmin = getSupabaseAdmin();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const { data: existing } = await supabaseAdmin
      .from("results")
      .select("id")
      .eq("student_id", row.student_id)
      .eq("assignment_id", row.assignment_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("results")
        .update({ score: row.score, grade: row.grade, exam_id: row.exam_id })
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

function pickFirst(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "").trim();
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

async function parseCsv(buffer: Buffer): Promise<Record<string, string>[]> {
  const Papa = await import("papaparse");
  const result = Papa.parse<Record<string, string>>(buffer.toString("utf-8"), {
    header: true, skipEmptyLines: true, transformHeader: normalizeHeader,
  });
  if (result.errors.length > 0) {
    const e = result.errors[0];
    throw new Error(`CSV error at row ${e.row}: ${e.message}`);
  }
  return result.data;
}

function parseExcel(buffer: Buffer): Record<string, string>[] {
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("Excel file has no sheets");

  const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
  if (data.length < 2) throw new Error("Excel file must have a header row and at least one data row");

  const headers = (data[0] || []).map(normalizeHeader);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < data.length; i++) {
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (data[i]?.[j] || "").toString().trim();
    }
    if (Object.values(row).some((v) => v)) rows.push(row);
  }

  return rows;
}

async function resolveStudentIds(
  schoolId: string,
  classId: string,
  rows: { identifier: string }[],
): Promise<Map<string, string>> {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, student_number, class_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId);

  if (error) throw error;

  const result = new Map<string, string>();

  for (const s of students || []) {
    if (s.student_number) {
      result.set(s.student_number.toLowerCase(), s.id);
    }
    if (s.profile_id) {
      result.set(s.profile_id.toLowerCase(), s.id);
    }
    result.set(s.id.toLowerCase(), s.id);
  }

  const missingIdentifiers = rows
    .map((r) => r.identifier.toLowerCase())
    .filter((id) => !result.has(id));

  if (missingIdentifiers.length > 0 && students && students.length > 0) {
    const profileIds = Array.from(
      new Set(students.map((s: any) => s.profile_id).filter(Boolean))
    );
    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", profileIds);

      for (const p of profiles || []) {
        if (p.email) {
          result.set(p.email.toLowerCase(), result.get(p.id.toLowerCase()) || p.id);
        }
      }
    }
  }

  return result;
}
