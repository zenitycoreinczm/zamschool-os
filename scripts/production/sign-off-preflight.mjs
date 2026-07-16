/**
 * Week 8 production sign-off preflight.
 * Usage: npm run production:sign-off
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const TSX = resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

const REQUIRED_DOCS = [
  "docs/PRODUCTION_SIGN_OFF.md",
  "docs/SECURITY_SIGN_OFF_CHECKLIST.md",
  "docs/DR_DRILL_RUNBOOK.md",
  "docs/DR_DRILL_LOG.md",
  "docs/STAKEHOLDER_APPROVAL.md",
  "docs/pilot/PILOT_READINESS_CHECKLIST.md",
  "docs/pilot/INCIDENT_LOG.md",
];

async function main() {
  const checks = [];

  function pass(label, detail) {
    checks.push({ ok: true, label, detail });
  }

  function fail(label, detail) {
    checks.push({ ok: false, label, detail });
  }

  for (const doc of REQUIRED_DOCS) {
    if (existsSync(resolve(ROOT, doc))) {
      pass(`Doc: ${doc}`, "present");
    } else {
      fail(`Doc: ${doc}`, "missing");
    }
  }

  const pilotPreflight = spawnSync(process.execPath, [TSX, "./scripts/pilot/preflight.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (pilotPreflight.status === 0) {
    pass("Pilot preflight (platform gates)", "passed");
  } else {
    fail("Pilot preflight (platform gates)", "failed - run npm run pilot:preflight");
  }

  const openP1 = existsSync(resolve(ROOT, "docs", "pilot", "INCIDENT_LOG.md"))
    ? readOpenPilotSeverity("P1")
    : false;

  if (openP1) {
    fail("Pilot incidents", "open P1 incident - resolve before sign-off");
  } else {
    pass("Pilot incidents", "no open P1 in incident log index");
  }

  console.log("\n=== Production sign-off preflight ===\n");
  for (const check of checks) {
    console.log(`${check.ok ? "✔" : "✖"} ${check.label}: ${check.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);

  if (failed.length) {
    console.log("\nComplete docs/PRODUCTION_SIGN_OFF.md before launch.\n");
    process.exit(1);
  }

  console.log("\nAutomated gates OK. Complete security, DR drill, and stakeholder sign-offs.\n");
  process.exit(0);
}

function readOpenPilotSeverity(severity) {
  const source = readFileSync(resolve(ROOT, "docs", "pilot", "INCIDENT_LOG.md"), "utf8");
  const rows = source.split("\n").filter((line) => line.startsWith("| INC-"));
  return rows.some((row) => row.includes(severity) && /open|investigating/i.test(row));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});