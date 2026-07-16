/**
 * Node-native load test runner (no k6 required).
 *
 * Usage:
 *   LOAD_TEST_BASE_URL=http://127.0.0.1:3000 node scripts/load-test/run-load-test.mjs --tier smoke
 *   LOAD_TEST_BEARER_TOKEN=<jwt> ... --tier tier1_100
 *
 * Writes: docs/LOAD_TEST_RESULTS.md
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importTsModule } from "../test-ts-module.mjs";
import { SCENARIOS, groupScenariosById } from "./scenarios.mjs";
import { summarize } from "./stats.mjs";

const { LOAD_TEST_TIERS, LOAD_TEST_SLOS, evaluateSlo } = await importTsModule(
  "../../lib/load-test-slo.ts",
  import.meta.url
);

const args = process.argv.slice(2);
const tierArg = args.find((a) => a.startsWith("--tier="))?.split("=")[1]
  || (args.includes("--tier") ? args[args.indexOf("--tier") + 1] : "smoke");

const tier = LOAD_TEST_TIERS[tierArg];
if (!tier) {
  console.error(`Unknown tier: ${tierArg}. Use smoke | tier1_100 | tier2_500 | tier3_1000`);
  process.exit(1);
}

const baseUrl = (process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const bearer = process.env.LOAD_TEST_BEARER_TOKEN || "";
const dryRun = args.includes("--dry-run");

console.log(`\n=== ZamSchool load test: ${tier.label} ===`);
console.log(`Target: ${baseUrl}`);
console.log(`Concurrency: ${tier.concurrency}, duration: ${tier.durationSec}s\n`);

if (!dryRun) {
  try {
    const probe = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (!probe.ok) {
      console.error(`Health probe failed: HTTP ${probe.status}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `Cannot reach ${baseUrl}. Start the app (npm run dev / npm start) or set LOAD_TEST_BASE_URL.`
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

const endAt = Date.now() + tier.durationSec * 1000;
const grouped = groupScenariosById();
/** @type {Record<string, { latencies: number[], errors: number, total: number }>} */
const results = {};

for (const scenarioId of grouped.keys()) {
  results[scenarioId] = { latencies: [], errors: 0, total: 0 };
}

async function runRequest(scenario) {
  const headers = { Accept: "application/json" };
  if (scenario.auth && bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}${scenario.path}`, {
      method: scenario.method,
      headers,
      body: scenario.body ? JSON.stringify(scenario.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });

    const elapsed = performance.now() - started;
    const bucket = results[scenario.id];
    bucket.total += 1;
    bucket.latencies.push(elapsed);

    if (scenario.auth && !bearer) {
      bucket.errors += 1;
      return;
    }

    if (response.status >= 500 || response.status === 429) {
      bucket.errors += 1;
    }
  } catch {
    const elapsed = performance.now() - started;
    const bucket = results[scenario.id];
    bucket.total += 1;
    bucket.latencies.push(elapsed);
    bucket.errors += 1;
  }
}

async function worker() {
  while (Date.now() < endAt) {
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    if (!dryRun) {
      await runRequest(scenario);
    }
  }
}

if (!dryRun) {
  await Promise.all(Array.from({ length: tier.concurrency }, () => worker()));
}

const durationSec = tier.durationSec;
const reportLines = [
  `# Load test results`,
  ``,
  `**Generated:** ${new Date().toISOString()}`,
  `**Tier:** ${tier.label} (\`${tierArg}\`)`,
  `**Target:** ${baseUrl}`,
  `**Concurrency:** ${tier.concurrency}`,
  `**Duration:** ${durationSec}s`,
  `**Auth token:** ${bearer ? "provided" : "_not set - authenticated scenarios count 401 as errors_"}`,
  ``,
  `| Scenario | Requests | Errors | Error % | p50 (ms) | **p95 (ms)** | p99 (ms) | SLO p95 | Pass |`,
  `|----------|----------|--------|---------|----------|--------------|----------|---------|------|`,
];

let allPass = true;

for (const [scenarioId, bucket] of Object.entries(results)) {
  const stats = summarize(bucket.latencies, bucket);
  stats.rps = Math.round((stats.total / durationSec) * 100) / 100;
  const evaluation = evaluateSlo(scenarioId, stats);
  if (!evaluation.pass && bucket.total > 0) {
    allPass = false;
  }

  const sloBudget = LOAD_TEST_SLOS[scenarioId];

  reportLines.push(
    `| ${scenarioId} | ${stats.total} | ${stats.errors} | ${stats.errorRatePercent}% | ${stats.p50Ms} | **${stats.p95Ms}** | ${stats.p99Ms} | ${sloBudget?.p95Ms ?? "-"} | ${bucket.total === 0 ? "skip" : evaluation.pass ? "✅" : "❌"} |`
  );

  console.log(`\n[${scenarioId}]`);
  console.log(`  requests: ${stats.total}, errors: ${stats.errors} (${stats.errorRatePercent}%)`);
  console.log(`  p50: ${stats.p50Ms}ms  p95: ${stats.p95Ms}ms  p99: ${stats.p99Ms}ms`);
  if (!evaluation.pass && bucket.total > 0) {
    console.log(`  SLO miss: ${evaluation.failures.join("; ")}`);
  }
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const reportPath = resolve(root, "docs", "LOAD_TEST_RESULTS.md");
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${reportLines.join("\n")}\n`, "utf8");

console.log(`\nReport written: ${reportPath}`);
console.log(allPass || dryRun ? "\nLoad test complete." : "\nOne or more scenarios missed SLO - see report.");
process.exit(allPass || dryRun ? 0 : 1);