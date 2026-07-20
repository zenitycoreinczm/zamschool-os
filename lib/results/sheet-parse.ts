/**
 * Shared mark-sheet parsing for teacher results upload/preview.
 * Supports Class Number + Name + Admission for accurate student matching.
 */

export const STUDENT_ID_COL_KEYS = [
  "exam_number",
  "exam_no",
  "examno",
  "exam",
  "candidate_number",
  "candidate_no",
  "candidate",
  "admission_number",
  "admission_no",
  "admission",
  "adm_number",
  "adm_no",
  "admno",
  "student_number",
  "student_no",
  "student_id",
  "learner_number",
  "learner_no",
  "index_number",
  "index_no",
  "registration",
  "reg_no",
  "regno",
  "reg_number",
  "id_number",
  "id_no",
  "sn",
  "s_n",
];

/** Register number within a class (unique per class). Preferred match key. */
export const CLASS_NUMBER_COL_KEYS = [
  "class_number",
  "class_no",
  "class_num",
  "class_n",
  "register_number",
  "register_no",
  "roll_number",
  "roll_no",
  "roll_num",
  "class_roll",
  "class_roll_no",
  "class_roll_number",
  "cls_no",
  "cls_number",
  "no_in_class",
  "number_in_class",
];

export const NAME_COL_KEYS = [
  "student_name",
  "full_name",
  "fullname",
  "learner_name",
  "learner",
  "pupil_name",
  "pupil",
  "name",
  "first_name",
  "surname",
  "last_name",
  "other_names",
];

export const MARKS_COL_KEYS = [
  "marks",
  "mark",
  "score",
  "scores",
  "points",
  "total",
  "total_marks",
  "raw_marks",
  "raw_mark",
  "percentage",
  "percent",
  "pct",
  "obtained",
  "obtained_marks",
  "mark_obtained",
  "marks_obtained",
  "result",
  "average",
  "avg",
];

export const GRADE_COL_KEYS = [
  "grade",
  "letter",
  "grade_letter",
  "letter_grade",
  "symbol",
  "grade_symbol",
  "division",
];

export type SheetParseRow = {
  identifier: string;
  classNumber: number | null;
  admissionNumber: string | null;
  name: string | null;
  marks: number | null;
  grade: string | null;
  raw: Record<string, string>;
};

export type SheetParseResult = {
  rows: SheetParseRow[];
  headers: string[];
  headerRowIndex: number;
  warnings: string[];
  foundStudentIdColumn: string | null;
  foundClassNumberColumn: string | null;
  foundNameColumn: string | null;
  foundMarksColumn: string | null;
  foundGradeColumn: string | null;
  sampleRows?: string[][];
};

export function normalizeHeader(value: string): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[%#]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .replace(/_+/g, "_");
}

function headerTokens(header: string): string[] {
  return normalizeHeader(header).split("_").filter(Boolean);
}

function scoreHeaderAgainstKeys(header: string, keys: string[]): number {
  const norm = normalizeHeader(header);
  if (!norm) return 0;
  if (keys.includes(norm)) return 100;

  let best = 0;
  for (const key of keys) {
    const keyNorm = normalizeHeader(key);
    if (!keyNorm) continue;
    if (norm === keyNorm) return 100;
    if (norm.includes(keyNorm) || keyNorm.includes(norm)) {
      best = Math.max(best, 70 + Math.min(keyNorm.length, 10));
    }
    const hTokens = new Set(headerTokens(norm));
    const kTokens = headerTokens(keyNorm);
    const overlap = kTokens.filter((t) => hTokens.has(t)).length;
    if (overlap > 0 && overlap === kTokens.length) {
      best = Math.max(best, 60 + overlap * 5);
    } else if (overlap >= 2) {
      best = Math.max(best, 50 + overlap * 5);
    }
  }
  return best;
}

function pickBestHeader(
  headers: string[],
  keys: string[],
  minScore = 45,
): string | null {
  let best: { header: string; score: number } | null = null;
  for (const header of headers) {
    const score = scoreHeaderAgainstKeys(header, keys);
    if (score < minScore) continue;
    if (!best || score > best.score) best = { header, score };
  }
  return best?.header ?? null;
}

export function pickFirst(row: Record<string, string>, keys: string[]): string {
  const entries: Array<[string, string]> = Object.entries(row).map(
    ([k, v]) => [normalizeHeader(k), String(v ?? "").trim()] as [string, string],
  );
  const map = new Map<string, string>(entries);
  for (const key of keys) {
    const hit = map.get(normalizeHeader(key));
    if (hit) return hit;
  }
  let bestVal = "";
  let bestScore = 0;
  for (const [k, v] of entries) {
    if (!v) continue;
    const score = scoreHeaderAgainstKeys(k, keys);
    if (score > bestScore) {
      bestScore = score;
      bestVal = v;
    }
  }
  return bestScore >= 45 ? bestVal : "";
}

export function parseMarksValue(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?$/);
  if (fraction) {
    const n = Number(fraction[1]);
    return Number.isFinite(n) ? n : null;
  }
  const cleaned = text.replace(/%/g, "").replace(/,/g, "").trim();
  if (/^[A-F][+-]?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseClassNumberCell(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  if (/^\d{1,5}$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^#\s*\d{1,5}$/.test(text) || /^no\.?\s*\d{1,5}$/i.test(text)) {
    const n = Number(text.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function looksLikeHeaderCell(value: string): boolean {
  const n = normalizeHeader(value);
  if (!n) return false;
  return (
    scoreHeaderAgainstKeys(n, STUDENT_ID_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, CLASS_NUMBER_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, NAME_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, MARKS_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, GRADE_COL_KEYS) >= 45
  );
}

function looksLikePersonName(value: string): boolean {
  const text = String(value || "").trim();
  if (!text || text.length < 2 || text.length > 80) return false;
  if (parseMarksValue(text) != null) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/^[\d.\s/-]+$/.test(text)) return false;
  return true;
}

function looksLikeStudentId(value: string): boolean {
  const text = String(value || "").trim();
  if (!text || text.length > 40) return false;
  if (parseMarksValue(text) != null && !/[a-zA-Z]/.test(text)) {
    return text.replace(/\D/g, "").length >= 4;
  }
  if (/[a-zA-Z]/.test(text) && /\d/.test(text)) return true;
  if (/^[A-Z0-9][A-Z0-9/_-]{2,}$/i.test(text) && !looksLikeHeaderCell(text)) {
    return true;
  }
  return false;
}

function buildIdentifier(parts: {
  classNumber: number | null;
  admissionNumber: string | null;
  name: string | null;
}): string {
  if (parts.classNumber != null) return String(parts.classNumber);
  if (parts.admissionNumber) return parts.admissionNumber;
  if (parts.name) return parts.name;
  return "";
}

export function findHeaderRowIndex(grid: string[][]): number {
  const maxScan = Math.min(grid.length, 30);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const cells = (grid[i] || []).map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter(Boolean);
    if (nonEmpty.length < 2) continue;

    const headers = nonEmpty.map(normalizeHeader);
    const idScore = Math.max(
      0,
      ...headers.map((h) => scoreHeaderAgainstKeys(h, STUDENT_ID_COL_KEYS)),
    );
    const classNoScore = Math.max(
      0,
      ...headers.map((h) => scoreHeaderAgainstKeys(h, CLASS_NUMBER_COL_KEYS)),
    );
    const nameScore = Math.max(
      0,
      ...headers.map((h) => scoreHeaderAgainstKeys(h, NAME_COL_KEYS)),
    );
    const marksScore = Math.max(
      0,
      ...headers.map((h) => scoreHeaderAgainstKeys(h, MARKS_COL_KEYS)),
    );
    const gradeScore = Math.max(
      0,
      ...headers.map((h) => scoreHeaderAgainstKeys(h, GRADE_COL_KEYS)),
    );
    const headerish = nonEmpty.filter(looksLikeHeaderCell).length;

    const combo =
      (idScore >= 45 || nameScore >= 45 || classNoScore >= 45 ? 40 : 0) +
      (marksScore >= 45 || gradeScore >= 45 ? 40 : 0) +
      headerish * 8 +
      classNoScore * 0.35 +
      idScore * 0.25 +
      nameScore * 0.2 +
      marksScore * 0.25 +
      Math.min(nonEmpty.length, 8);

    if (combo > bestScore) {
      bestScore = combo;
      bestIdx = i;
    }
  }

  if (bestScore < 40) return -1;
  return bestIdx;
}

export function gridToObjects(grid: string[][]): {
  rows: Record<string, string>[];
  headers: string[];
  headerRowIndex: number;
} {
  if (grid.length === 0) {
    return { rows: [], headers: [], headerRowIndex: 0 };
  }

  const headerRowIndex = findHeaderRowIndex(grid);
  if (headerRowIndex < 0) {
    const width = Math.max(...grid.map((r) => (r || []).length), 0);
    const headers = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
    const rows: Record<string, string>[] = [];
    for (const line of grid) {
      const row: Record<string, string> = {};
      let any = false;
      for (let j = 0; j < width; j++) {
        const val = String(line?.[j] ?? "").trim();
        row[headers[j]] = val;
        if (val) any = true;
      }
      if (any) rows.push(row);
    }
    return { rows, headers, headerRowIndex: -1 };
  }

  const rawHeaders = (grid[headerRowIndex] || []).map((h) =>
    String(h ?? "").trim(),
  );
  const headers = rawHeaders.map((h, idx) => {
    const norm = normalizeHeader(h);
    return norm || `column_${idx + 1}`;
  });

  const seen = new Map<string, number>();
  const uniqueHeaders = headers.map((h) => {
    const count = seen.get(h) || 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });

  const rows: Record<string, string>[] = [];
  for (let i = headerRowIndex + 1; i < grid.length; i++) {
    const line = grid[i] || [];
    const row: Record<string, string> = {};
    let any = false;
    for (let j = 0; j < uniqueHeaders.length; j++) {
      const val = String(line[j] ?? "").trim();
      row[uniqueHeaders[j]] = val;
      if (val) any = true;
    }
    if (any) rows.push(row);
  }

  return { rows, headers: uniqueHeaders, headerRowIndex };
}

export function parseSheetRows(
  objects: Record<string, string>[],
  options?: { totalMarks?: number },
): SheetParseResult {
  const warnings: string[] = [];
  if (objects.length === 0) {
    return emptyResult(["No data rows found in file"]);
  }

  const headers = Object.keys(objects[0] || {});
  const foundClassNumberColumn = pickBestHeader(
    headers,
    CLASS_NUMBER_COL_KEYS,
    50,
  );
  const foundStudentIdColumn = pickBestHeader(
    headers.filter((h) => h !== foundClassNumberColumn),
    STUDENT_ID_COL_KEYS,
  );
  const foundNameColumn = pickBestHeader(headers, NAME_COL_KEYS);
  const foundMarksColumn = pickBestHeader(headers, MARKS_COL_KEYS);
  const foundGradeColumn = pickBestHeader(headers, GRADE_COL_KEYS);

  const totalMarks = options?.totalMarks;
  const parsed: SheetParseRow[] = [];

  for (const [index, row] of objects.entries()) {
    const name =
      (foundNameColumn
        ? String(row[foundNameColumn] || "").trim()
        : pickFirst(row, NAME_COL_KEYS)) || null;

    const admissionNumber =
      (foundStudentIdColumn
        ? String(row[foundStudentIdColumn] || "").trim()
        : pickFirst(row, STUDENT_ID_COL_KEYS)) || null;

    let classNumber: number | null = null;
    if (foundClassNumberColumn) {
      classNumber = parseClassNumberCell(
        String(row[foundClassNumberColumn] || ""),
      );
    }
    if (classNumber == null) {
      classNumber = parseClassNumberCell(pickFirst(row, CLASS_NUMBER_COL_KEYS));
    }

    let identifier = buildIdentifier({ classNumber, admissionNumber, name });

    if (!identifier) {
      for (const h of headers) {
        if (scoreHeaderAgainstKeys(h, MARKS_COL_KEYS) >= 50) continue;
        if (scoreHeaderAgainstKeys(h, GRADE_COL_KEYS) >= 50) continue;
        const v = String(row[h] || "").trim();
        if (v && !looksLikeHeaderCell(v)) {
          identifier = v;
          if (classNumber == null) classNumber = parseClassNumberCell(v);
          break;
        }
      }
    }

    if (!identifier) {
      warnings.push(`Row ${index + 1}: no student identifier — skipped`);
      continue;
    }

    // Skip repeated header rows
    if (looksLikeHeaderCell(identifier) && !parseMarksValue(identifier)) {
      const norm = normalizeHeader(identifier);
      if (
        STUDENT_ID_COL_KEYS.includes(norm) ||
        NAME_COL_KEYS.includes(norm) ||
        CLASS_NUMBER_COL_KEYS.includes(norm) ||
        MARKS_COL_KEYS.includes(norm)
      ) {
        continue;
      }
    }

    const rawMarks = foundMarksColumn
      ? String(row[foundMarksColumn] || "").trim()
      : pickFirst(row, MARKS_COL_KEYS);

    let marks = parseMarksValue(rawMarks);
    if (marks == null) {
      for (const h of headers) {
        if (
          h === foundStudentIdColumn ||
          h === foundNameColumn ||
          h === foundClassNumberColumn
        ) {
          continue;
        }
        const m = parseMarksValue(String(row[h] || ""));
        if (m != null) {
          marks = m;
          break;
        }
      }
    }

    if (marks != null && totalMarks != null && totalMarks > 0) {
      if (marks < 0 || marks > totalMarks) {
        marks = Math.max(0, Math.min(totalMarks, marks));
      }
    }

    let grade =
      (foundGradeColumn
        ? String(row[foundGradeColumn] || "").trim()
        : pickFirst(row, GRADE_COL_KEYS)) || null;
    if (!grade) {
      for (const h of headers) {
        const v = String(row[h] || "").trim();
        if (/^[A-F][+-]?$/i.test(v)) {
          grade = v.toUpperCase();
          break;
        }
      }
    }

    parsed.push({
      identifier,
      classNumber,
      admissionNumber,
      name,
      marks,
      grade: grade || null,
      raw: row,
    });
  }

  return {
    rows: parsed,
    headers,
    headerRowIndex: 0,
    warnings: warnings.slice(0, 30),
    foundStudentIdColumn,
    foundClassNumberColumn,
    foundNameColumn,
    foundMarksColumn,
    foundGradeColumn,
  };
}

export function parseGridByContent(
  grid: string[][],
  options?: { totalMarks?: number },
): SheetParseResult {
  const warnings: string[] = [];
  const nonEmpty = grid.filter((r) =>
    (r || []).some((c) => String(c || "").trim()),
  );
  if (nonEmpty.length === 0) return emptyResult(warnings);

  // Use header path when possible via objects
  const converted = gridToObjects(nonEmpty);
  if (converted.headerRowIndex >= 0) {
    const byHeader = parseSheetRows(converted.rows, options);
    if (byHeader.rows.length > 0) {
      return {
        ...byHeader,
        headerRowIndex: converted.headerRowIndex,
        sampleRows: nonEmpty
          .slice(0, 5)
          .map((r) => (r || []).map((c) => String(c ?? ""))),
      };
    }
  }

  // Headerless / weak headers: treat col0 as class no or id, name, marks...
  const width = Math.max(...nonEmpty.map((r) => (r || []).length), 0);
  const parsed: SheetParseRow[] = [];

  for (const line of nonEmpty) {
    const cells = (line || []).map((c) => String(c ?? "").trim());
    if (cells.filter(looksLikeHeaderCell).length >= 2) continue;

    let classNumber: number | null = null;
    let admissionNumber: string | null = null;
    let name: string | null = null;
    let marks: number | null = null;
    let grade: string | null = null;

    for (let c = 0; c < width; c++) {
      const val = cells[c] || "";
      if (!val) continue;
      if (looksLikeHeaderCell(val)) continue;

      if (marks == null) {
        const m = parseMarksValue(val);
        // Prefer later columns for marks
        if (m != null && c >= Math.max(1, width - 3)) {
          marks = m;
          continue;
        }
      }
      if (!grade && /^[A-F][+-]?$/i.test(val)) {
        grade = val.toUpperCase();
        continue;
      }
      if (classNumber == null) {
        const cn = parseClassNumberCell(val);
        if (cn != null && cn < 500 && c === 0) {
          classNumber = cn;
          continue;
        }
      }
      if (looksLikePersonName(val) && !name) {
        name = val;
        continue;
      }
      if (looksLikeStudentId(val) && !admissionNumber) {
        admissionNumber = val;
        continue;
      }
      if (marks == null) {
        const m = parseMarksValue(val);
        if (m != null) marks = m;
      }
    }

    const identifier = buildIdentifier({ classNumber, admissionNumber, name });
    if (!identifier) continue;

    if (marks != null && options?.totalMarks && options.totalMarks > 0) {
      if (marks < 0 || marks > options.totalMarks) {
        marks = Math.max(0, Math.min(options.totalMarks, marks));
      }
    }

    const raw: Record<string, string> = {};
    cells.forEach((v, idx) => {
      raw[`column_${idx + 1}`] = v;
    });

    parsed.push({
      identifier,
      classNumber,
      admissionNumber,
      name,
      marks,
      grade,
      raw,
    });
  }

  return {
    rows: parsed,
    headers: Object.keys(parsed[0]?.raw || {}),
    headerRowIndex: -1,
    warnings,
    foundStudentIdColumn: null,
    foundClassNumberColumn: null,
    foundNameColumn: null,
    foundMarksColumn: null,
    foundGradeColumn: null,
    sampleRows: nonEmpty
      .slice(0, 5)
      .map((r) => (r || []).map((c) => String(c ?? ""))),
  };
}

export function parseResultsGrid(
  grid: string[][],
  options?: { totalMarks?: number },
): SheetParseResult {
  const cleaned = (grid || [])
    .map((row) =>
      (row || []).map((c) => String(c ?? "").replace(/^\uFEFF/, "").trim()),
    )
    .filter((row) => row.some((c) => c));

  const sampleRows = cleaned.slice(0, 6);
  if (cleaned.length === 0) {
    return { ...emptyResult(["File appears empty"]), sampleRows };
  }

  const converted = gridToObjects(cleaned);
  let result = parseSheetRows(converted.rows, options);
  result = {
    ...result,
    sampleRows,
    headerRowIndex: converted.headerRowIndex,
  };

  if (result.rows.length > 0) return result;

  const content = parseGridByContent(cleaned, options);
  if (content.rows.length > 0) {
    return {
      ...content,
      sampleRows,
      warnings: [
        ...result.warnings,
        "Used flexible column detection (headers were unclear).",
        ...content.warnings,
      ].slice(0, 30),
    };
  }

  return {
    ...result,
    sampleRows,
    warnings: [
      ...result.warnings,
      "Header and content detection both found no student rows.",
    ],
  };
}

export function detectCsvDelimiter(text: string): string {
  const sample = text.slice(0, 4000);
  const lines = sample.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10);
  if (lines.length === 0) return ",";

  const candidates = [",", ";", "\t", "|"] as const;
  let best = ",";
  let bestScore = -1;
  for (const d of candidates) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance =
      counts.reduce((a, b) => a + (b - avg) ** 2, 0) / counts.length;
    const score = avg > 0 ? avg * 10 - variance : -1;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function buildNoDataMessage(result: SheetParseResult): string {
  const cols =
    result.headers.length > 0
      ? result.headers.slice(0, 12).join(", ")
      : "(none)";
  const sample =
    result.sampleRows && result.sampleRows.length > 0
      ? ` First rows: ${result.sampleRows
          .slice(0, 3)
          .map((r) => `[${r.filter(Boolean).slice(0, 5).join(" | ")}]`)
          .join(" ")}`
      : "";
  return (
    `Could not read student rows from this file. Detected columns: ${cols}.${sample} ` +
    `Recommended headers: Class Number, Name, Marks (and optional Admission No / Grade).`
  );
}

export const RESULTS_CSV_TEMPLATE = `Class Number,Name,Admission No,Marks,Grade
1,Alice Banda,STU-001,88,A
2,John Phiri,STU-002,72,B
3,Mary Zulu,STU-003,65,C
`;

function emptyResult(warnings: string[] = []): SheetParseResult {
  return {
    rows: [],
    headers: [],
    headerRowIndex: 0,
    warnings,
    foundStudentIdColumn: null,
    foundClassNumberColumn: null,
    foundNameColumn: null,
    foundMarksColumn: null,
    foundGradeColumn: null,
  };
}
