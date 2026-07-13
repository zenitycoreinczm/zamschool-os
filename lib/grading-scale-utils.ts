export type ScaleBandInput = {
  min_score: number;
  max_score: number;
  grade: string;
  description?: string | null;
  name?: string | null;
};

export type ScalePreset = {
  id: string;
  label: string;
  description: string;
  bands: Array<{
    grade: string;
    minScore: number;
    maxScore: number;
    description: string;
  }>;
};

/** ECZ-style numeric descriptors (common in Zambian schools). */
export const ECZ_NUMERIC_PRESET: ScalePreset = {
  id: "ecz-numeric",
  label: "ECZ numeric (1–5)",
  description: "Distinction through fail using ECZ-style grade points.",
  bands: [
    { grade: "1", minScore: 75, maxScore: 100, description: "Distinction" },
    { grade: "2", minScore: 65, maxScore: 74, description: "Merit" },
    { grade: "3", minScore: 50, maxScore: 64, description: "Credit" },
    { grade: "4", minScore: 40, maxScore: 49, description: "Pass" },
    { grade: "5", minScore: 0, maxScore: 39, description: "Fail" },
  ],
};

export const LETTER_PERCENT_PRESET: ScalePreset = {
  id: "letter-percent",
  label: "Letter grades (A–F)",
  description: "Percentage bands mapped to letter grades for reports.",
  bands: [
    { grade: "A", minScore: 80, maxScore: 100, description: "Excellent" },
    { grade: "B", minScore: 70, maxScore: 79, description: "Very good" },
    { grade: "C", minScore: 60, maxScore: 69, description: "Good" },
    { grade: "D", minScore: 50, maxScore: 59, description: "Satisfactory" },
    { grade: "E", minScore: 40, maxScore: 49, description: "Pass" },
    { grade: "F", minScore: 0, maxScore: 39, description: "Fail" },
  ],
};

export const GRADING_PRESETS = [ECZ_NUMERIC_PRESET, LETTER_PERCENT_PRESET];

export function analyzeScaleCoverage(
  bands: ScaleBandInput[],
  ceiling = 100,
): {
  coveragePercent: number;
  gaps: Array<{ from: number; to: number }>;
  overlaps: Array<{ a: string; b: string; from: number; to: number }>;
} {
  const sorted = [...bands].sort((left, right) => left.min_score - right.min_score);
  const gaps: Array<{ from: number; to: number }> = [];
  const overlaps: Array<{ a: string; b: string; from: number; to: number }> = [];

  let covered = 0;
  let cursor = 0;

  for (const band of sorted) {
    const min = Math.max(0, Math.min(ceiling, band.min_score));
    const max = Math.max(0, Math.min(ceiling, band.max_score));
    if (max < min) continue;

    if (min > cursor) {
      gaps.push({ from: cursor, to: min - 1 });
    }

    for (const other of sorted) {
      if (other === band) continue;
      const oMin = other.min_score;
      const oMax = other.max_score;
      const overlapFrom = Math.max(min, oMin);
      const overlapTo = Math.min(max, oMax);
      if (overlapFrom <= overlapTo) {
        overlaps.push({
          a: band.grade,
          b: other.grade,
          from: overlapFrom,
          to: overlapTo,
        });
      }
    }

    const segmentStart = Math.max(cursor, min);
    covered += Math.max(0, max - segmentStart + 1);
    cursor = Math.max(cursor, max + 1);
  }

  if (cursor <= ceiling) {
    gaps.push({ from: cursor, to: ceiling });
  }

  const totalPoints = ceiling + 1;
  const coveragePercent = Math.min(
    100,
    Math.round((covered / totalPoints) * 100),
  );

  const uniqueOverlaps = overlaps.filter(
    (item, index, list) =>
      list.findIndex(
        (other) =>
          other.a === item.a &&
          other.b === item.b &&
          other.from === item.from &&
          other.to === item.to,
      ) === index,
  );

  return {
    coveragePercent,
    gaps: gaps.filter((gap) => gap.from <= gap.to),
    overlaps: uniqueOverlaps,
  };
}

export function bandTone(grade: string, index: number) {
  const palette = [
    "bg-emerald-500",
    "bg-sky-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-orange-500",
    "bg-rose-500",
    "bg-slate-500",
  ];
  if (/^1$|^a$/i.test(grade)) return palette[0];
  if (/^2$|^b$/i.test(grade)) return palette[1];
  if (/^3$|^c$/i.test(grade)) return palette[2];
  if (/^4$|^d$/i.test(grade)) return palette[3];
  if (/^5$|^e$/i.test(grade)) return palette[4];
  if (/^f$/i.test(grade)) return palette[5];
  return palette[index % palette.length];
}