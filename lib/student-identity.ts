/**
 * Student desk identity: "Ison Mumbuna | 9A | 45"
 * Used in shell sidebar, roll call, and results surfaces.
 */

export type StudentIdentityParts = {
  displayName: string;
  className?: string | null;
  classNumber?: number | string | null;
};

export function formatStudentIdentityLine(parts: StudentIdentityParts): string {
  const name = String(parts.displayName || "").trim() || "Student";
  const classLabel = String(parts.className || "").trim() || "—";
  const numberRaw = parts.classNumber;
  const number =
    numberRaw == null || numberRaw === ""
      ? "—"
      : String(numberRaw).trim() || "—";
  return `${name} | ${classLabel} | ${number}`;
}

export function parsePositiveClassNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  const raw = String(value ?? "").trim();
  if (!/^\d{1,5}$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  return n > 0 ? n : null;
}
