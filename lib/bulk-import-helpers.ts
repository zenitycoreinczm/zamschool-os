/**
 * Pure helpers for CSV bulk import (class resolution, payload building).
 * Kept free of Next/Supabase side effects so unit tests can import safely.
 */

export type BulkImportRole = "STUDENT" | "TEACHER" | "PARENT";
export type ImportRow = Record<string, unknown>;
export type ClassOption = { id: string; name: string };

/** Normalize CSV headers/keys so class / Class / class_name all work. */
export function normalizeImportRow(row: ImportRow): ImportRow {
  const out: ImportRow = {};
  for (const [key, value] of Object.entries(row || {})) {
    const k = String(key || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");
    out[k] = typeof value === "string" ? value.trim() : value;
  }
  if (out.admission_no && !out.admission_number) {
    out.admission_number = out.admission_no;
  }
  if (out.student_number && !out.admission_number) {
    out.admission_number = out.student_number;
  }
  if (out.classname && !out.class) out.class = out.classname;
  if (out.class_name && !out.class) out.class = out.class_name;
  return out;
}

export function readClassField(row: ImportRow): string | null {
  return (
    normalizeOptionalString(row.class) ||
    normalizeOptionalString(row.class_name) ||
    normalizeOptionalString(row.class_id) ||
    normalizeOptionalString(row.classname) ||
    null
  );
}

/**
 * Resolve class name or UUID from CSV against school classes.
 * Matches case-insensitive; also allows “Form1” ≈ “Form 1”.
 */
export function resolveClassId(
  classRef: string,
  classes: ClassOption[],
): string | null {
  const raw = String(classRef || "").trim();
  if (!raw) return null;

  if (classes.some((c) => c.id === raw)) return raw;

  const norm = normalizeClassLabel(raw);
  const exact = classes.find(
    (c) => normalizeClassLabel(c.name) === norm || c.id === raw,
  );
  if (exact) return exact.id;

  const soft = classes.filter((c) => {
    const n = normalizeClassLabel(c.name);
    return n.includes(norm) || norm.includes(n);
  });
  if (soft.length === 1) return soft[0]!.id;

  return null;
}

function normalizeClassLabel(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function buildManagedAccountPayload(
  role: BulkImportRole,
  row: ImportRow,
  classes: ClassOption[] = [],
) {
  const normalized = normalizeImportRow(row);
  const { firstName, lastName } = splitName(normalized.name);
  const email = normalizeEmail(normalized.email);

  if (!email) {
    throw new Error("Imported row is missing a valid email address.");
  }

  if (role === "STUDENT") {
    const classRef = readClassField(normalized);
    const classId = classRef ? resolveClassId(classRef, classes) : null;
    if (!classId) {
      throw new Error(
        classRef
          ? `Class “${classRef}” was not found. Create it under Classes first.`
          : "Every student must be assigned to a class (class column).",
      );
    }

    return {
      role: "student",
      firstName,
      lastName,
      email,
      phone: normalizeOptionalString(normalized.phone),
      profileExtras: {
        admission_number: normalizeOptionalString(normalized.admission_number),
        gender: normalizeOptionalString(normalized.gender),
        status: normalizeOptionalString(normalized.status),
        class_id: classId,
        date_of_birth: normalizeOptionalString(normalized.date_of_birth),
      },
    };
  }

  return {
    role: role.toLowerCase(),
    firstName,
    lastName,
    email,
    phone: normalizeOptionalString(normalized.phone),
    profileExtras:
      role === "TEACHER"
        ? {
            employee_id: normalizeOptionalString(normalized.employee_id),
            gender: normalizeOptionalString(normalized.gender),
            status: normalizeOptionalString(normalized.status),
          }
        : {
            gender: normalizeOptionalString(normalized.gender),
            status: normalizeOptionalString(normalized.status),
          },
    parentExtras:
      role === "PARENT"
        ? {
            relation_type: normalizeOptionalString(normalized.relation_type),
            occupation: normalizeOptionalString(normalized.occupation),
          }
        : undefined,
  };
}

function splitName(value: unknown) {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts.slice(0, -1).join(" ") || parts[0] || "Unknown",
    lastName: parts.length > 1 ? parts.slice(-1).join(" ") : "",
  };
}

export function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeEmail(value: unknown) {
  const trimmed = normalizeOptionalString(value);
  return trimmed ? trimmed.toLowerCase() : null;
}
