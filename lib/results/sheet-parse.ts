/**
 * Shared mark-sheet parsing for teacher results upload/preview.
 * Tolerant of title rows, varied headers, headerless sheets, and ;/\t CSVs.
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
  "id",
  "no",
  "number",
  "sn",
  "s_n",
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
  foundNameColumn: string | null;
  foundMarksColumn: string | null;
  foundGradeColumn: string | null;
  /** First few raw grid rows for UI diagnostics */
  sampleRows?: string[][];
};

/** Normalize headers to snake_case keys for stable lookups. */
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
    if (!best || score > best.score) {
      best = { header, score };
    }
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

/** Parse marks like "75", "75%", "75/100", "75.5". */
export function parseMarksValue(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;

  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?$/);
  if (fraction) {
    const n = Number(fraction[1]);
    return Number.isFinite(n) ? n : null;
  }

  const cleaned = text.replace(/%/g, "").replace(/,/g, "").trim();
  // Reject pure letter grades
  if (/^[A-F][+-]?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function looksLikeHeaderCell(value: string): boolean {
  const n = normalizeHeader(value);
  if (!n) return false;
  return (
    scoreHeaderAgainstKeys(n, STUDENT_ID_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, NAME_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, MARKS_COL_KEYS) >= 45 ||
    scoreHeaderAgainstKeys(n, GRADE_COL_KEYS) >= 45
  );
}

function looksLikePersonName(value: string): boolean {
  const text = String(value || "").trim();
  if (!text || text.length < 2 || text.length > 80) return false;
  if (parseMarksValue(text) != null) return false;
  // At least one letter; allow spaces, hyphens, apostrophes
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/^[\d.\s/-]+$/.test(text)) return false;
  return true;
}

function looksLikeStudentId(value: string): boolean {
  const text = String(value || "").trim();
  if (!text || text.length > 40) return false;
  if (parseMarksValue(text) != null && !/[a-zA-Z]/.test(text)) {
    // Pure numbers can be admission numbers (e.g. 2024001) if long enough
    return text.replace(/\D/g, "").length >= 4;
  }
  // Mixed codes like STU-001, G7/023
  if (/[a-zA-Z]/.test(text) && /\d/.test(text)) return true;
  if (/^[A-Z0-9][A-Z0-9/_-]{2,}$/i.test(text) && !looksLikeHeaderCell(text)) {
    return true;
  }
  return false;
}

/**
 * Detect the real header row when sheets start with a title / school name.
 */
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
      ...headers.map((h) => scoreHeaderAgainstKeys(h, STUDENT_ID_COL_KEYS)),
      0,
    );
    const nameScore = Math.max(
      ...headers.map((h) => scoreHeaderAgainstKeys(h, NAME_COL_KEYS)),
      0,
    );
    const marksScore = Math.max(
      ...headers.map((h) => scoreHeaderAgainstKeys(h, MARKS_COL_KEYS)),
      0,
    );
    const gradeScore = Math.max(
      ...headers.map((h) => scoreHeaderAgainstKeys(h, GRADE_COL_KEYS)),
      0,
    );

    const headerish = nonEmpty.filter(looksLikeHeaderCell).length;
    const combo =
      (idScore >= 45 || nameScore >= 45 ? 40 : 0) +
      (marksScore >= 45 || gradeScore >= 45 ? 40 : 0) +
      headerish * 8 +
      idScore * 0.25 +
      nameScore * 0.2 +
      marksScore * 0.25 +
      gradeScore * 0.1 +
      Math.min(nonEmpty.length, 8);

    if (combo > bestScore) {
      bestScore = combo;
      bestIdx = i;
    }
  }

  // If nothing looked like headers, keep 0 (may be headerless data)
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
    // Headerless: invent column_1, column_2, ...
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

/**
 * Infer id / name / marks column indexes from cell *content* across the grid.
 */
export function inferColumnRoles(grid: string[][]): {
  idCol: number | null;
  nameCol: number | null;
  marksCol: number | null;
  gradeCol: number | null;
} {
  const width = Math.max(...grid.map((r) => (r || []).length), 0);
  if (width === 0) {
    return { idCol: null, nameCol: null, marksCol: null, gradeCol: null };
  }

  const scores = Array.from({ length: width }, () => ({
    id: 0,
    name: 0,
    marks: 0,
    grade: 0,
    filled: 0,
  }));

  const dataRows = grid.filter((r) => (r || []).some((c) => String(c || "").trim()));
  const sample = dataRows.slice(0, 40);

  for (const row of sample) {
    for (let c = 0; c < width; c++) {
      const val = String(row?.[c] ?? "").trim();
      if (!val) continue;
      scores[c].filled += 1;
      if (looksLikeHeaderCell(val)) continue;
      if (parseMarksValue(val) != null && !looksLikeStudentId(val)) {
        scores[c].marks += 1;
      } else if (/^[A-F][+-]?$/i.test(val) || /^[1-9]$/.test(val) && val.length === 1) {
        // letter grade or division 1-9 carefully — only count letter grades high
        if (/^[A-F][+-]?$/i.test(val)) scores[c].grade += 1;
      }
      if (looksLikeStudentId(val)) scores[c].id += 1;
      if (looksLikePersonName(val)) scores[c].name += 1;
    }
  }

  const pickMax = (key: "id" | "name" | "marks" | "grade", min: number) => {
    let bestIdx: number | null = null;
    let best = min - 1;
    for (let i = 0; i < width; i++) {
      const s = scores[i][key];
      if (s > best) {
        best = s;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  let marksCol = pickMax("marks", 1);
  let idCol = pickMax("id", 1);
  let nameCol = pickMax("name", 1);
  let gradeCol = pickMax("grade", 1);

  // Avoid collisions
  if (idCol != null && idCol === marksCol) {
    // Prefer marks for pure numbers if many are marks-like
    if ((scores[idCol].marks || 0) >= (scores[idCol].id || 0)) {
      idCol = null;
    } else {
      marksCol = null;
    }
  }
  if (nameCol != null && (nameCol === idCol || nameCol === marksCol)) {
    nameCol = null;
  }
  if (gradeCol != null && (gradeCol === idCol || gradeCol === marksCol || gradeCol === nameCol)) {
    gradeCol = null;
  }

  // Positional fallback: col0 id/name, last numeric col marks
  if (marksCol == null) {
    for (let c = width - 1; c >= 0; c--) {
      if (scores[c].marks > 0) {
        marksCol = c;
        break;
      }
    }
  }
  if (idCol == null && nameCol == null) {
    for (let c = 0; c < width; c++) {
      if (c === marksCol || c === gradeCol) continue;
      if (scores[c].filled > 0) {
        if (scores[c].name >= scores[c].id) nameCol = c;
        else idCol = c;
        break;
      }
    }
  }

  return { idCol, nameCol, marksCol, gradeCol };
}

/**
 * Parse rows using content heuristics (works with or without headers).
 */
export function parseGridByContent(
  grid: string[][],
  options?: { totalMarks?: number },
): SheetParseResult {
  const warnings: string[] = [];
  const nonEmpty = grid.filter((r) => (r || []).some((c) => String(c || "").trim()));
  if (nonEmpty.length === 0) {
    return emptyResult(warnings);
  }

  // Drop leading title-only rows (single cell or no mark/id pattern)
  let start = 0;
  while (start < nonEmpty.length) {
    const cells = (nonEmpty[start] || []).map((c) => String(c ?? "").trim()).filter(Boolean);
    const headerish = cells.filter(looksLikeHeaderCell).length;
    if (headerish >= 2) {
      start += 1; // skip pure header row
      break;
    }
    if (cells.length <= 1 && !looksLikeStudentId(cells[0] || "") && !looksLikePersonName(cells[0] || "")) {
      start += 1;
      continue;
    }
    // If this row looks like a header line, skip it
    if (cells.length >= 2 && cells.every((c) => looksLikeHeaderCell(c) || !parseMarksValue(c))) {
      const allHeader = cells.filter(looksLikeHeaderCell).length >= Math.min(2, cells.length);
      if (allHeader) {
        start += 1;
        break;
      }
    }
    break;
  }

  const body = nonEmpty.slice(start);
  // If first body row is headers, drop it for content scoring
  let dataStart = 0;
  if (body[0]) {
    const cells = body[0].map((c) => String(c ?? "").trim()).filter(Boolean);
    if (cells.filter(looksLikeHeaderCell).length >= 2) {
      dataStart = 1;
    }
  }

  const data = body.slice(dataStart);
  const roles = inferColumnRoles(data.length > 0 ? data : body);
  const parsed: SheetParseRow[] = [];

  for (let i = 0; i < data.length; i++) {
    const line = data[i] || [];
    const cells = line.map((c) => String(c ?? "").trim());

    let identifier = "";
    if (roles.idCol != null) identifier = cells[roles.idCol] || "";
    if (!identifier && roles.nameCol != null) identifier = cells[roles.nameCol] || "";

    if (!identifier) {
      // First non-mark, non-grade cell
      for (let c = 0; c < cells.length; c++) {
        if (c === roles.marksCol || c === roles.gradeCol) continue;
        if (cells[c]) {
          identifier = cells[c];
          break;
        }
      }
    }

    if (!identifier || looksLikeHeaderCell(identifier)) continue;

    let marks: number | null = null;
    if (roles.marksCol != null) {
      marks = parseMarksValue(cells[roles.marksCol] || "");
    }
    if (marks == null) {
      // Scan for a marks-like cell
      for (let c = cells.length - 1; c >= 0; c--) {
        if (c === roles.idCol || c === roles.nameCol) continue;
        const m = parseMarksValue(cells[c] || "");
        if (m != null) {
          marks = m;
          break;
        }
      }
    }

    let grade: string | null = null;
    if (roles.gradeCol != null) {
      grade = cells[roles.gradeCol] || null;
    }
    if (!grade) {
      for (const cell of cells) {
        if (/^[A-F][+-]?$/i.test(cell)) {
          grade = cell.toUpperCase();
          break;
        }
      }
    }

    if (marks != null && options?.totalMarks && options.totalMarks > 0) {
      if (marks < 0 || marks > options.totalMarks) {
        marks = Math.max(0, Math.min(options.totalMarks, marks));
      }
    }

    const raw: Record<string, string> = {};
    cells.forEach((v, idx) => {
      raw[`column_${idx + 1}`] = v;
    });

    parsed.push({ identifier, marks, grade, raw });
  }

  return {
    rows: parsed,
    headers: Object.keys(parsed[0]?.raw || {}),
    headerRowIndex: start,
    warnings,
    foundStudentIdColumn: roles.idCol != null ? `column_${roles.idCol + 1}` : null,
    foundNameColumn: roles.nameCol != null ? `column_${roles.nameCol + 1}` : null,
    foundMarksColumn: roles.marksCol != null ? `column_${roles.marksCol + 1}` : null,
    foundGradeColumn: roles.gradeCol != null ? `column_${roles.gradeCol + 1}` : null,
    sampleRows: nonEmpty.slice(0, 5).map((r) => (r || []).map((c) => String(c ?? ""))),
  };
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
  const foundStudentIdColumn = pickBestHeader(headers, STUDENT_ID_COL_KEYS);
  const foundNameColumn = pickBestHeader(headers, NAME_COL_KEYS);
  const foundMarksColumn = pickBestHeader(headers, MARKS_COL_KEYS);
  const foundGradeColumn = pickBestHeader(headers, GRADE_COL_KEYS);

  const totalMarks = options?.totalMarks;
  const parsed: SheetParseRow[] = [];

  for (const [index, row] of objects.entries()) {
    let identifier = foundStudentIdColumn
      ? String(row[foundStudentIdColumn] || "").trim()
      : pickFirst(row, STUDENT_ID_COL_KEYS);

    if (
      identifier &&
      foundStudentIdColumn &&
      /^(no|number|sn|s_n|column_\d+)$/.test(foundStudentIdColumn) &&
      foundNameColumn
    ) {
      const nameVal = String(row[foundNameColumn] || "").trim();
      if (nameVal && /^\d{1,3}$/.test(identifier)) {
        identifier = nameVal;
      }
    }

    if (!identifier && foundNameColumn) {
      identifier = String(row[foundNameColumn] || "").trim();
    }

    if (!identifier) {
      // Any non-marks cell
      for (const h of headers) {
        if (scoreHeaderAgainstKeys(h, MARKS_COL_KEYS) >= 50) continue;
        if (scoreHeaderAgainstKeys(h, GRADE_COL_KEYS) >= 50) continue;
        const v = String(row[h] || "").trim();
        if (v && !looksLikeHeaderCell(v)) {
          identifier = v;
          break;
        }
      }
    }

    // Absolute last resort: first non-empty value
    if (!identifier) {
      for (const h of headers) {
        const v = String(row[h] || "").trim();
        if (v) {
          identifier = v;
          break;
        }
      }
    }

    if (!identifier) {
      warnings.push(`Row ${index + 1}: no student identifier — skipped`);
      continue;
    }

    if (
      STUDENT_ID_COL_KEYS.includes(normalizeHeader(identifier)) ||
      NAME_COL_KEYS.includes(normalizeHeader(identifier)) ||
      MARKS_COL_KEYS.includes(normalizeHeader(identifier))
    ) {
      continue;
    }

    const rawMarks = foundMarksColumn
      ? String(row[foundMarksColumn] || "").trim()
      : pickFirst(row, MARKS_COL_KEYS);

    let marks = parseMarksValue(rawMarks);
    if (marks == null) {
      // Scan all cells for a marks value
      for (const h of headers) {
        if (h === foundStudentIdColumn || h === foundNameColumn) continue;
        const m = parseMarksValue(String(row[h] || ""));
        if (m != null) {
          marks = m;
          break;
        }
      }
    }

    if (rawMarks && marks == null) {
      warnings.push(
        `Row ${index + 1}: "${rawMarks}" is not a valid mark — kept without marks`,
      );
    }

    if (marks != null && totalMarks != null && totalMarks > 0) {
      if (marks < 0 || marks > totalMarks) {
        warnings.push(
          `Row ${index + 1}: marks ${marks} outside 0–${totalMarks} — clamped`,
        );
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
    foundNameColumn,
    foundMarksColumn,
    foundGradeColumn,
  };
}

/**
 * Full pipeline from a 2D grid → student rows.
 * Tries header-based parse, then content-based fallback.
 */
export function parseResultsGrid(
  grid: string[][],
  options?: { totalMarks?: number },
): SheetParseResult {
  const cleaned = (grid || [])
    .map((row) => (row || []).map((c) => String(c ?? "").replace(/^\uFEFF/, "").trim()))
    .filter((row) => row.some((c) => c));

  const sampleRows = cleaned.slice(0, 6);

  if (cleaned.length === 0) {
    return { ...emptyResult(["File appears empty"]), sampleRows };
  }

  // Strategy 1: header-aware object parse
  const converted = gridToObjects(cleaned);
  let result = parseSheetRows(converted.rows, options);
  result = { ...result, sampleRows, headerRowIndex: converted.headerRowIndex };

  if (result.rows.length > 0) {
    return result;
  }

  // Strategy 2: content / positional heuristics on the raw grid
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

/** Detect CSV delimiter from a sample of the file text. */
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
    // Prefer consistent multi-column splits
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
          .map((r) => `[${r.filter(Boolean).slice(0, 4).join(" | ")}]`)
          .join(" ")}`
      : "";
  return (
    `Could not read student rows from this file. Detected columns: ${cols}.${sample} ` +
    `Use a header row like: Admission No, Name, Marks — or download the template.`
  );
}

export const RESULTS_CSV_TEMPLATE = `Admission No,Name,Marks,Grade
STU-001,Alice Banda,88,A
STU-002,John Phiri,72,B
STU-003,Mary Zulu,65,C
`;

function emptyResult(warnings: string[] = []): SheetParseResult {
  return {
    rows: [],
    headers: [],
    headerRowIndex: 0,
    warnings,
    foundStudentIdColumn: null,
    foundNameColumn: null,
    foundMarksColumn: null,
    foundGradeColumn: null,
  };
}
