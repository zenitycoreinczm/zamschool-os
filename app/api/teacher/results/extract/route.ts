import { NextRequest, NextResponse } from "next/server";

import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { requireTeacherContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  safeErrorMessage,
} from "@/lib/server-guards";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getECZGrade } from "@/lib/zambia-localization";

/**
 * Mobile mark-sheet extract (parse only — does not save).
 * POST /api/teacher/results/extract  (multipart FormData)
 *
 * Fields: file, subjectCode?, subjectName?, className?, examLabel?,
 *         subjectId?, classId?, totalMarks?
 *
 * For CSV/Excel: structured parse.
 * For images/PDF: returns guidance that OCR is not yet available server-side
 * (rows empty + message) so the client can queue offline rather than crash.
 *
 * Confirmed rows are saved via POST /api/teacher/results/save.
 */

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const STUDENT_ID_COL_KEYS = [
  "exam_number",
  "exam no",
  "examno",
  "admission_number",
  "admission no",
  "student_number",
  "student_id",
  "id",
  "registration",
  "reg_no",
  "adm_no",
  "admno",
];
const NAME_COL_KEYS = [
  "student_name",
  "name",
  "full_name",
  "fullname",
  "learner",
];
const MARKS_COL_KEYS = ["marks", "mark", "score", "points", "total", "raw_marks"];
const GRADE_COL_KEYS = ["grade", "letter", "grade_letter", "letter_grade"];

function normalizeHeader(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function pickFirst(row: Record<string, string>, keys: string[]): string {
  const map = new Map(
    Object.entries(row).map(([k, v]) => [normalizeHeader(k), String(v ?? "")]),
  );
  for (const key of keys) {
    const hit = map.get(normalizeHeader(key));
    if (hit && hit.trim()) return hit.trim();
  }
  return "";
}

async function parseCsv(buffer: Buffer): Promise<Record<string, string>[]> {
  const text = buffer.toString("utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseExcel(buffer: Buffer): Record<string, string>[] {
  // Lazy require so cold starts without xlsx path still work for CSV.
  const XLSX = require("xlsx") as typeof import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return json.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[String(k)] = String(v ?? "");
    }
    return out;
  });
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId || !userId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `teacher-results-extract:${userId}:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: access.context.profileId || userId,
    });
    if (
      assignmentScope.actorTeacherIds.length === 0 ||
      assignmentScope.allowedClassIds.length === 0
    ) {
      return NextResponse.json(
        { error: "No assigned teaching scope found" },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const subjectCode = String(formData.get("subjectCode") || "").trim();
    const subjectName = String(formData.get("subjectName") || "").trim();
    const className = String(formData.get("className") || "").trim();
    const examLabel = String(formData.get("examLabel") || "").trim();
    const classId = String(formData.get("classId") || "").trim() || null;
    const totalMarksRaw = formData.get("totalMarks");
    const totalMarks = totalMarksRaw ? Number(totalMarksRaw) : 100;

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
        },
        { status: 400 },
      );
    }

    if (classId && !assignmentScope.allowedClassIds.includes(classId)) {
      return NextResponse.json(
        { error: "You are not assigned to this class" },
        { status: 403 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = (file.name || "").toLowerCase();
    const mime = String(file.type || "").toLowerCase();

    const isSpreadsheet =
      fileName.endsWith(".csv") ||
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xls") ||
      mime.includes("csv") ||
      mime.includes("spreadsheet") ||
      mime.includes("excel");

    if (!isSpreadsheet) {
      // Images/PDF: no server OCR yet — soft response so mobile can queue.
      return NextResponse.json({
        success: true,
        data: [],
        rows: [],
        message:
          "Image/PDF OCR is not available on this endpoint yet. Upload a CSV or Excel mark sheet, or enter scores manually.",
        channel: "parse",
        examLabel,
        subjectCode,
        subjectName,
        className,
      });
    }

    let rows: Record<string, string>[] = [];
    if (fileName.endsWith(".csv") || mime.includes("csv")) {
      rows = await parseCsv(buffer);
    } else {
      rows = parseExcel(buffer);
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No data rows found in file" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: gradingScales } = await supabaseAdmin
      .from("grading_scales")
      .select("min_score, max_score, grade")
      .eq("school_id", schoolId)
      .order("min_score", { ascending: true });

    const extracted = [];
    for (const row of rows) {
      const admissionNumber = pickFirst(row, STUDENT_ID_COL_KEYS);
      const studentName = pickFirst(row, NAME_COL_KEYS);
      if (!admissionNumber && !studentName) continue;

      const rawMarks = pickFirst(row, MARKS_COL_KEYS);
      let score: number | null = null;
      if (rawMarks) {
        const n = Number(String(rawMarks).replace(/[^0-9.]/g, ""));
        if (Number.isFinite(n)) {
          score = Math.max(0, Math.min(totalMarks, n));
        }
      }
      const grade =
        pickFirst(row, GRADE_COL_KEYS) ||
        (score != null
          ? computeGrade(score, totalMarks, gradingScales || [])
          : null);

      extracted.push({
        studentName,
        student_name: studentName,
        admissionNumber,
        admission_number: admissionNumber,
        className,
        class_name: className,
        subjectCode,
        subject_code: subjectCode,
        subjectName,
        subject_name: subjectName,
        score,
        marks: score,
        maxMarks: totalMarks,
        max_marks: totalMarks,
        grade,
        confidence: 1,
      });
    }

    return NextResponse.json({
      success: true,
      data: extracted,
      rows: extracted,
      message: `${extracted.length} rows extracted`,
      channel: "parse",
      examLabel,
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to extract mark sheet") },
      { status: 500 },
    );
  }
}

function computeGrade(
  score: number,
  totalMarks: number,
  scales: Array<{ min_score: number; max_score: number; grade: string }>,
): string {
  const pct = totalMarks > 0 ? (score / totalMarks) * 100 : score;
  for (const scale of scales) {
    if (pct >= Number(scale.min_score) && pct <= Number(scale.max_score)) {
      return scale.grade;
    }
  }
  return getECZGrade(pct).grade;
}
