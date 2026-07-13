import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const scriptPath = resolve(process.cwd(), "scripts", "audit-refresh.mjs");
const packagePath = resolve(process.cwd(), "package.json");
const auditDocPath = resolve(process.cwd(), "docs", "AUDIT.md");

test("package.json wires `audit:refresh` to the new script", async () => {
  const pkg = await readFile(packagePath, "utf8");
  assert.match(
    pkg,
    /"audit:refresh":\s*"node\s+\.\/scripts\/audit-refresh\.mjs"/,
    "`audit:refresh` must point at scripts/audit-refresh.mjs",
  );
});

test("audit-refresh script declares and walks the cited invariants", async () => {
  const script = await readFile(scriptPath, "utf8");
  // The script body must define a list of invariants and exercise them.
  assert.match(script, /const invariants = \[/);
  assert.match(script, /app\/globals\.css/);
  assert.match(script, /components\/workspace\/MobileDock\.tsx/);
  assert.match(script, /lib\/tenant\/tenant-context\.ts/);
  assert.match(script, /role-page-orchestrators/);
});

test("audit-refresh script exits 0 against the current working tree", async () => {
  const { stdout, stderr } = await exec(
    process.execPath,
    [scriptPath],
    { cwd: process.cwd() },
  );
  assert.ok(
    /Totals: [0-9]+ pass · 0 fail/.test(stdout),
    `expected all invariants to pass; got:\n${stdout}\n${stderr}`,
  );
});

test("docs/AUDIT.md references the audit:refresh script", async () => {
  const doc = await readFile(auditDocPath, "utf8");
  assert.match(
    doc,
    /npm run audit:refresh/,
    "docs/AUDIT.md should mention the audit:refresh script in the future-work section",
  );
});
