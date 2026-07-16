/**
 * Pilot go-live preflight - aggregates Week 1–6 gates.
 * Usage: npm run pilot:preflight
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const TSX = resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

async function main() {
  const checks = [];

  function pass(label, detail) {
    checks.push({ ok: true, label, detail });
  }

  function fail(label, detail) {
    checks.push({ ok: false, label, detail });
  }

  function run(command, args, label) {
    const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8" });
    if (result.status === 0) {
      pass(label, "passed");
      return true;
    }
    fail(label, (result.stderr || result.stdout || "").trim().slice(0, 200) || `exit ${result.status}`);
    return false;
  }

  const requiredDocs = [
    "docs/pilot/PILOT_SCHOOL_RUNBOOK.md",
    "docs/pilot/PILOT_READINESS_CHECKLIST.md",
    "docs/pilot/INCIDENT_LOG.md",
    "docs/pilot/SCHOOL_PROFILE.template.md",
    "docs/LOAD_TEST_PLAN.md",
    "docs/CDN_AND_R2.md",
  ];

  for (const doc of requiredDocs) {
    if (existsSync(resolve(ROOT, doc))) {
      pass(`Doc: ${doc}`, "present");
    } else {
      fail(`Doc: ${doc}`, "missing");
    }
  }

  run(process.execPath, [TSX, "./scripts/cdn-preflight.mjs"], "CDN preflight");
  run(process.execPath, ["./scripts/security/audit-service-role-tenant.mjs", "--strict"], "Tenant audit (strict)");
  run(process.execPath, [TSX, "./scripts/load-test/run-load-test.mjs", "--tier", "smoke", "--dry-run"], "Load test plan (dry-run)");

  const healthUrl = process.env.PILOT_HEALTH_URL || process.env.LOAD_TEST_BASE_URL;
  if (healthUrl) {
    try {
      const base = healthUrl.replace(/\/+$/, "");
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        pass("Health endpoint", `${base}/api/health → ${response.status}`);
      } else {
        fail("Health endpoint", `HTTP ${response.status}`);
      }
    } catch (error) {
      fail("Health endpoint", error instanceof Error ? error.message : String(error));
    }
  } else {
    pass("Health endpoint", "skipped (set PILOT_HEALTH_URL to probe)");
  }

  console.log("\n=== Pilot preflight ===\n");
  for (const check of checks) {
    console.log(`${check.ok ? "✔" : "✖"} ${check.label}: ${check.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.\n`);

  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});