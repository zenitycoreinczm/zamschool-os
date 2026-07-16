/**
 * School desk / hero stat display helpers.
 *
 * Do not show bare "-" for school metrics across the product. Use:
 * - "…" while loading
 * - "0" for count/money/rate zeros or missing counts after load
 * - "Not set" only for optional text identity fields
 */

export type SchoolStatKind = "count" | "text" | "money" | "percent";

const DASH_VALUES = new Set(["—", "-", "–", "−", "n/a", "na", "null", "undefined"]);

export function isPlaceholderDash(value: unknown): boolean {
  if (value == null) return true;
  const s = String(value).trim().toLowerCase();
  return !s || DASH_VALUES.has(s);
}

/**
 * Format a school-related stat for UI.
 * Never returns a lone em/en dash placeholder.
 */
export function formatSchoolStatValue(
  value: string | number | null | undefined,
  options: { loading?: boolean; kind?: SchoolStatKind } = {},
): string {
  const kind = options.kind ?? "count";
  if (options.loading) return "…";

  if (value === null || value === undefined) {
    return kind === "text" ? "Not set" : "0";
  }

  const raw = String(value).trim();
  if (!raw || DASH_VALUES.has(raw.toLowerCase())) {
    return kind === "text" ? "Not set" : "0";
  }

  return raw;
}

/** Prefer first non-empty map hit for metric labels (case-insensitive). */
export function pickMetricValue(
  metricMap: Record<string, string>,
  ...labels: string[]
): string | undefined {
  for (const label of labels) {
    const hit = metricMap[label.toLowerCase()];
    if (hit != null && String(hit).trim() !== "") {
      return hit;
    }
  }
  return undefined;
}

export type SchoolHeroStat = {
  label: string;
  value: string;
  hint?: string;
  tone: "sky" | "violet" | "amber" | "emerald" | "slate";
};

const TONES = ["sky", "violet", "amber", "emerald"] as const;

/**
 * Build hero stats from live summary metrics with safe empty handling.
 * When metrics are loaded, use them (up to 4). While loading with no cache, show "…".
 * After load with no metrics, show fallback labels at "0" - never "-".
 */
export function schoolHeroStatsFromSummary(
  metrics: Array<{ label: string; value: string; hint?: string }>,
  fallback: Array<{ label: string; hint?: string }>,
  loading: boolean,
  options?: { tone?: SchoolHeroStat["tone"] },
): SchoolHeroStat[] {
  const forcedTone = options?.tone;
  const toTone = (index: number): SchoolHeroStat["tone"] =>
    forcedTone ?? TONES[index % TONES.length];

  if (metrics.length > 0) {
    return metrics.slice(0, Math.max(4, fallback.length || 4)).map((m, i) => ({
      label: m.label,
      value: formatSchoolStatValue(m.value),
      hint: m.hint,
      tone: toTone(i),
    }));
  }

  return fallback.map((item, i) => ({
    label: item.label,
    value: loading ? "…" : "0",
    hint: item.hint,
    tone: toTone(i),
  }));
}

/** Session / profile fields that are school-related text. */
export function formatSchoolTextField(
  value: string | null | undefined,
  options: { loading?: boolean; emptyLabel?: string } = {},
): string {
  if (options.loading) return "…";
  if (value == null || !String(value).trim() || isPlaceholderDash(value)) {
    return options.emptyLabel ?? "Not set";
  }
  return String(value).trim();
}
