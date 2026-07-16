import type { WorkspaceMetric } from "@/lib/workspace/summary";
import { formatSchoolStatValue } from "@/lib/workspace/metric-display";

/**
 * Map workspace metrics into AdminPageHero stat cards.
 * Decorative icons are no longer rendered in hero/stat UIs.
 * Values never surface bare "-" placeholders for school metrics.
 */
export function metricsToStatCards(metrics: WorkspaceMetric[]) {
  return metrics.map((metric, index) => ({
    label: metric.label,
    value: formatSchoolStatValue(metric.value),
    hint: metric.hint,
    tone: (["sky", "violet", "amber", "emerald"] as const)[index % 4],
  }));
}
