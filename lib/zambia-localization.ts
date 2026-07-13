/**
 * ZamSchool OS — Zambian Localization & Data Validation Module
 * Standardizes currency, phone formatting (+260), and ECZ grading structures.
 */

// ─── Phone Number Validation & Normalization (+260) ──────────────────────────

/**
 * Operator prefixes (national significant number, 9 digits after stripping 0/+260).
 *
 * Airtel: 097 / 077
 * MTN:    096 / 076
 * Zamtel: 095 / 075
 *
 * Both the 09x and 07x forms are valid for each network.
 */
export const ZAMBIAN_MOBILE_PREFIXES = [
  "95",
  "96",
  "97",
  "75",
  "76",
  "77",
] as const;

const MOBILE_PREFIX_SET = new Set<string>(ZAMBIAN_MOBILE_PREFIXES);

/**
 * Extract the 9-digit national mobile number (e.g. 770234564 or 977123456).
 * Accepts common local forms: 0770…, 0977…, +260770…, 260977…, with spaces/dashes.
 */
export function extractZambianNationalMobile(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  // Keep digits only so spaces, dashes, and parentheses never break signup.
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;

  // Country code without +
  if (digits.startsWith("260")) {
    digits = digits.slice(3);
  }
  // Trunk prefix
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // National mobile numbers are 9 digits.
  if (digits.length !== 9) return null;

  const prefix = digits.slice(0, 2);
  if (!MOBILE_PREFIX_SET.has(prefix)) return null;

  return digits;
}

/**
 * Validates whether a given string is a valid Zambian mobile number.
 * Supports Airtel (097/077), MTN (096/076), Zamtel (095/075).
 */
export function isValidZambianPhone(phone: string | null | undefined): boolean {
  return extractZambianNationalMobile(phone) !== null;
}

/**
 * Normalizes any valid Zambian phone input into canonical international format: +260XXXXXXXXX
 * Example: 0770234564 → +260770234564
 */
export function normalizeZambianPhone(
  phone: string | null | undefined,
): string | null {
  const national = extractZambianNationalMobile(phone);
  if (!national) return null;
  return `+260${national}`;
}

/**
 * Empty phone is allowed (optional field). Non-empty must be a valid Zambian mobile.
 * Returns null when valid; otherwise a short UI/API error string.
 */
export function zambianPhoneValidationError(
  phone: string | null | undefined,
  options?: { required?: boolean },
): string | null {
  const raw = String(phone || "").trim();
  if (!raw) {
    return options?.required ? "Phone number is required." : null;
  }
  if (isValidZambianPhone(raw)) return null;
  return "Enter a valid Zambian mobile (Airtel 097/077, MTN 096/076, Zamtel 095/075). Example: 0770234564 or +260770234564.";
}

/**
 * Normalize optional phone for storage. Invalid non-empty input returns null
 * so callers can reject before write (pair with zambianPhoneValidationError).
 */
export function normalizeOptionalZambianPhone(
  phone: string | null | undefined,
): string | null {
  const raw = String(phone || "").trim();
  if (!raw) return null;
  return normalizeZambianPhone(raw);
}

// ─── Currency Formatting (ZMW / Kwacha) ──────────────────────────────────────

/**
 * Formats a numeric amount as Zambian Kwacha (ZMW).
 * Example: 1500.5 -> "ZMW 1,500.50"
 * Compact school UI often uses symbol: "K" → "K1,500.50"
 */
export function formatKwacha(
  amount: number | null | undefined,
  options?: { symbol?: "ZMW" | "K"; decimals?: number },
): string {
  const value = typeof amount === "number" && !Number.isNaN(amount) ? amount : 0;
  const decimals =
    typeof options?.decimals === "number"
      ? Math.max(0, Math.min(2, options.decimals))
      : 2;
  const formatted = value.toLocaleString("en-ZM", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (options?.symbol === "K") {
    return `K${formatted}`;
  }
  return `ZMW ${formatted}`;
}

// ─── ECZ (Examinations Council of Zambia) Grading Standard ───────────────────

export type ECZGrade = {
  grade: string;
  label: string;
  points: number;
  minMark: number;
  maxMark: number;
};

export const ECZ_GRADE_SCALE: ECZGrade[] = [
  { grade: "One", label: "Distinction", points: 1, minMark: 75, maxMark: 100 },
  { grade: "Two", label: "Distinction", points: 2, minMark: 70, maxMark: 74 },
  { grade: "Three", label: "Merit", points: 3, minMark: 65, maxMark: 69 },
  { grade: "Four", label: "Merit", points: 4, minMark: 60, maxMark: 64 },
  { grade: "Five", label: "Credit", points: 5, minMark: 55, maxMark: 59 },
  { grade: "Six", label: "Credit", points: 6, minMark: 50, maxMark: 54 },
  { grade: "Seven", label: "Satisfactory", points: 7, minMark: 45, maxMark: 49 },
  { grade: "Eight", label: "Satisfactory", points: 8, minMark: 40, maxMark: 44 },
  { grade: "Nine", label: "Unsatisfactory", points: 9, minMark: 0, maxMark: 39 },
];

/**
 * Resolves an exam mark (0-100) to its corresponding ECZ Grade & classification.
 */
export function getECZGrade(mark: number): ECZGrade {
  const clamped = Math.max(0, Math.min(100, Math.round(mark)));
  return (
    ECZ_GRADE_SCALE.find((g) => clamped >= g.minMark && clamped <= g.maxMark) || {
      grade: "Nine",
      label: "Unsatisfactory",
      points: 9,
      minMark: 0,
      maxMark: 39,
    }
  );
}
