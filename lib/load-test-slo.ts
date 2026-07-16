export type LoadTestTierId = "tier1_100" | "tier2_500" | "tier3_1000" | "smoke";

export type LoadTestScenarioId =
  | "public_pages"
  | "public_api"
  | "account_read"
  | "teacher_bootstrap"
  | "admin_dashboard";

export type LoadTestSlo = {
  p95Ms: number;
  p99Ms: number;
  maxErrorRatePercent: number;
};

export const LOAD_TEST_TIERS: Record<
  LoadTestTierId,
  { label: string; concurrency: number; durationSec: number; description: string }
> = {
  smoke: {
    label: "Smoke",
    concurrency: 5,
    durationSec: 15,
    description: "CI/local sanity check before full tiers",
  },
  tier1_100: {
    label: "100 concurrent users",
    concurrency: 25,
    durationSec: 60,
    description: "Single-school peak (~100 active sessions)",
  },
  tier2_500: {
    label: "500 concurrent users",
    concurrency: 100,
    durationSec: 120,
    description: "District-scale burst",
  },
  tier3_1000: {
    label: "1000 concurrent users",
    concurrency: 200,
    durationSec: 180,
    description: "Stress test - expect Supabase pool / Redis limits",
  },
};

/** p95 latency budgets by scenario (milliseconds). */
export const LOAD_TEST_SLOS: Record<LoadTestScenarioId, LoadTestSlo> = {
  public_pages: { p95Ms: 800, p99Ms: 1500, maxErrorRatePercent: 1 },
  public_api: { p95Ms: 300, p99Ms: 600, maxErrorRatePercent: 0.5 },
  account_read: { p95Ms: 1200, p99Ms: 2500, maxErrorRatePercent: 1 },
  teacher_bootstrap: { p95Ms: 2500, p99Ms: 5000, maxErrorRatePercent: 2 },
  admin_dashboard: { p95Ms: 2000, p99Ms: 4000, maxErrorRatePercent: 2 },
};

export function evaluateSlo(
  scenario: LoadTestScenarioId,
  stats: { p95Ms: number; p99Ms: number; errorRatePercent: number }
): { pass: boolean; failures: string[] } {
  const slo = LOAD_TEST_SLOS[scenario];
  const failures: string[] = [];

  if (stats.p95Ms > slo.p95Ms) {
    failures.push(`p95 ${stats.p95Ms}ms > budget ${slo.p95Ms}ms`);
  }
  if (stats.p99Ms > slo.p99Ms) {
    failures.push(`p99 ${stats.p99Ms}ms > budget ${slo.p99Ms}ms`);
  }
  if (stats.errorRatePercent > slo.maxErrorRatePercent) {
    failures.push(
      `error rate ${stats.errorRatePercent}% > budget ${slo.maxErrorRatePercent}%`
    );
  }

  return { pass: failures.length === 0, failures };
}