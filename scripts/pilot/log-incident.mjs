/**
 * Append a pilot incident to docs/pilot/INCIDENT_LOG.md
 *
 * Usage:
 *   node scripts/pilot/log-incident.mjs --severity P2 --summary "..." --school "Pilot HS"
 *   npm run pilot:log-incident -- --severity P3 --summary "Avatar slow" --reporter "ICT"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const LOG_PATH = resolve(ROOT, "docs", "pilot", "INCIDENT_LOG.md");

function readArg(name) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

const severity = (readArg("severity") || "P3").toUpperCase();
const summary = readArg("summary");
const school = readArg("school") || "Pilot school";
const reporter = readArg("reporter") || "-";
const status = readArg("status") || "open";

if (!summary) {
  console.error("Required: --summary \"...\"");
  process.exit(1);
}

if (!/^P[1-4]$/.test(severity)) {
  console.error("Severity must be P1, P2, P3, or P4");
  process.exit(1);
}

const now = new Date();
const dateSlug = now.toISOString().slice(0, 10);
const source = readFileSync(LOG_PATH, "utf8");
const existingIds = [...source.matchAll(/## (INC-\d{4}-\d{2}-\d{2}-\d{3})/g)].map((m) => m[1]);
const seq = String(existingIds.length + 1).padStart(3, "0");
const id = `INC-${dateSlug}-${seq}`;
const opened = now.toISOString();

const block = `
## ${id}

| Field | Value |
|-------|-------|
| **Opened** | ${opened} |
| **Severity** | ${severity} |
| **Status** | ${status} |
| **School** | ${school} |
| **Reporter** | ${reporter} |
| **Summary** | ${summary} |
| **Impact** | TBD |
| **Root cause** | TBD |
| **Mitigation** | TBD |
| **Closed** | - |
`;

let next = source;
const indexRow = "| _none yet_ | | | | |";
if (next.includes(indexRow)) {
  next = next.replace(
    indexRow,
    `| ${id} | ${dateSlug} | ${severity} | ${status} | ${summary.replace(/\|/g, "/")} |`
  );
} else {
  next = next.replace(
    /(\|----\|------\|----------\|--------\|--------\|\n)/,
    `$1| ${id} | ${dateSlug} | ${severity} | ${status} | ${summary.replace(/\|/g, "/")} |\n`
  );
}

const marker = "<!-- New incidents are appended below this line -->";
if (!next.includes(marker)) {
  console.error("Incident log marker missing; append manually.");
  process.exit(1);
}

next = next.replace(marker, `${marker}\n${block}`);
writeFileSync(LOG_PATH, next, "utf8");

console.log(`Logged ${id} (${severity}): ${summary}`);
console.log(`Updated: docs/pilot/INCIDENT_LOG.md`);