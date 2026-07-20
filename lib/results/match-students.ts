/**
 * Match parsed result-sheet rows to students in a selected class.
 * Priority (within class only):
 *   1. class_number (register #)
 *   2. admission / student / exam number
 *   3. unique exact name
 * Never match by name alone when two students share the same name.
 */

export type MatchableStudent = {
  id: string;
  classId: string;
  classNumber: number | null;
  admissionNumber: string | null;
  displayName: string;
};

export type SheetMatchInput = {
  classNumber?: number | null;
  admissionNumber?: string | null;
  name?: string | null;
  identifier?: string | null;
};

export type StudentMatchResult = {
  student: MatchableStudent | null;
  method: "class_number" | "admission" | "name" | "none";
  ambiguous: boolean;
  reason?: string;
};

function normalizeKey(value: string | null | undefined): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function compactKey(value: string | null | undefined): string {
  return normalizeKey(value).replace(/[\s_.-]/g, "");
}

function parseClassNumber(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  const text = String(value).trim();
  // "#12" or "No. 12" or "12"
  const match = text.match(/(?:^|[^\d])(\d{1,5})(?:[^\d]|$)/);
  if (!match) return null;
  // Prefer whole-string pure integer
  if (/^\d{1,5}$/.test(text)) {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (/^#?\s*\d{1,5}$/.test(text) || /^no\.?\s*\d{1,5}$/i.test(text)) {
    const n = Number(text.replace(/[^\d]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

export function buildStudentMatchIndex(students: MatchableStudent[]) {
  const byClassNumber = new Map<number, MatchableStudent[]>();
  const byAdmission = new Map<string, MatchableStudent[]>();
  const byName = new Map<string, MatchableStudent[]>();

  const push = <K,>(map: Map<K, MatchableStudent[]>, key: K, student: MatchableStudent) => {
    const list = map.get(key) || [];
    list.push(student);
    map.set(key, list);
  };

  for (const student of students) {
    if (student.classNumber != null && student.classNumber > 0) {
      push(byClassNumber, student.classNumber, student);
    }
    if (student.admissionNumber) {
      push(byAdmission, normalizeKey(student.admissionNumber), student);
      push(byAdmission, compactKey(student.admissionNumber), student);
    }
    push(byAdmission, normalizeKey(student.id), student);
    if (student.displayName) {
      push(byName, normalizeKey(student.displayName), student);
      push(byName, compactKey(student.displayName), student);
    }
  }

  return { byClassNumber, byAdmission, byName };
}

export type StudentMatchIndex = ReturnType<typeof buildStudentMatchIndex>;

export function matchSheetRowToStudent(
  row: SheetMatchInput,
  index: StudentMatchIndex,
): StudentMatchResult {
  // 1) Class register number — unique within class
  const classNo =
    row.classNumber != null && row.classNumber > 0
      ? row.classNumber
      : parseClassNumber(row.identifier) ??
        parseClassNumber(row.admissionNumber);

  if (classNo != null) {
    const hits = index.byClassNumber.get(classNo) || [];
    const unique = dedupeById(hits);
    if (unique.length === 1) {
      // If a name is also present, soft-check it for confidence
      if (row.name) {
        const nameKey = normalizeKey(row.name);
        const studentName = normalizeKey(unique[0].displayName);
        if (
          nameKey &&
          studentName &&
          nameKey !== studentName &&
          !studentName.includes(nameKey) &&
          !nameKey.includes(studentName)
        ) {
          // Class number wins but flag mismatch for UI warning
          return {
            student: unique[0],
            method: "class_number",
            ambiguous: false,
            reason: `Class no. ${classNo} matched; name "${row.name}" differs from "${unique[0].displayName}"`,
          };
        }
      }
      return { student: unique[0], method: "class_number", ambiguous: false };
    }
    if (unique.length > 1) {
      return {
        student: null,
        method: "none",
        ambiguous: true,
        reason: `Class number ${classNo} matched ${unique.length} students`,
      };
    }
  }

  // 2) Admission / exam / student number
  const admissionCandidates = [
    row.admissionNumber,
    row.identifier,
  ].filter(Boolean) as string[];

  for (const raw of admissionCandidates) {
    const hits = [
      ...(index.byAdmission.get(normalizeKey(raw)) || []),
      ...(index.byAdmission.get(compactKey(raw)) || []),
    ];
    const unique = dedupeById(hits);
    if (unique.length === 1) {
      return { student: unique[0], method: "admission", ambiguous: false };
    }
    if (unique.length > 1) {
      // Try disambiguate with class number or name
      if (classNo != null) {
        const narrowed = unique.filter((s) => s.classNumber === classNo);
        if (narrowed.length === 1) {
          return { student: narrowed[0], method: "admission", ambiguous: false };
        }
      }
      if (row.name) {
        const nameKey = normalizeKey(row.name);
        const byName = unique.filter(
          (s) => normalizeKey(s.displayName) === nameKey,
        );
        if (byName.length === 1) {
          return { student: byName[0], method: "admission", ambiguous: false };
        }
      }
      return {
        student: null,
        method: "none",
        ambiguous: true,
        reason: `Admission "${raw}" is ambiguous`,
      };
    }
  }

  // 3) Unique name within class only
  const nameCandidates = [row.name, row.identifier].filter(Boolean) as string[];
  for (const raw of nameCandidates) {
    // Skip if looks like pure number (already tried as class no)
    if (/^\d{1,5}$/.test(String(raw).trim())) continue;

    const hits = [
      ...(index.byName.get(normalizeKey(raw)) || []),
      ...(index.byName.get(compactKey(raw)) || []),
    ];
    const unique = dedupeById(hits);
    if (unique.length === 1) {
      return { student: unique[0], method: "name", ambiguous: false };
    }
    if (unique.length > 1) {
      return {
        student: null,
        method: "none",
        ambiguous: true,
        reason: `Name "${raw}" matches ${unique.length} students in this class — add Class Number`,
      };
    }
  }

  return {
    student: null,
    method: "none",
    ambiguous: false,
    reason: "No match in the selected class",
  };
}

function dedupeById(students: MatchableStudent[]): MatchableStudent[] {
  const map = new Map<string, MatchableStudent>();
  for (const s of students) {
    map.set(s.id, s);
  }
  return Array.from(map.values());
}

export { parseClassNumber };
