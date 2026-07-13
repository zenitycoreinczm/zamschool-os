#!/usr/bin/env node
/**
 * Audit-refresh script for docs/AUDIT.md.
 *
 * Walks the cited source files referenced from docs/AUDIT.md, verifies
 * that the key invariants still hold in the working tree, and emits a
 * freshness report. The audit doc is treated as input; the script does
 * not modify it. The author of the audit uses the report to decide
 * which sections of docs/AUDIT.md need line-number updates.
 *
 * Usage:
 *   node scripts/audit-refresh.mjs
 *   node scripts/audit-refresh.mjs --json
 *
 * Output goes to stdout. Exit code is 0 if every invariant passes,
 * non-zero otherwise. The author treats this as a smoke test for the
 * audit freshness claim, not a substitute for a full read.
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Each invariant is a regex search over a target source file. The script
// re-reads the file from the working tree and asserts the regex matches.
// The audit author writes these by hand to mirror the "Done Well" and
// "Needs Work" claims in docs/AUDIT.md.
const invariants = [
  {
    id: "design-tokens-centralized",
    title: "Design tokens live in app/globals.css",
    file: "app/globals.css",
    re: /@theme\s*{/,
  },
  {
    id: "mobile-first-shell",
    title: "Workspace shell is mobile-first (100dvh)",
    file: "app/globals.css",
    re: /100dvh/,
  },
  {
    id: "per-role-code-splitting",
    title: "RoleBasedShell dynamic-imports role shells",
    file: "components/RoleBasedShell.tsx",
    re: /dynamic\(.*?\)|next\/dynamic/,
  },
  {
    id: "mobile-dock-typed-contract",
    title: "MobileDock exposes a typed isActive prop",
    file: "components/workspace/MobileDock.tsx",
    re: /isActive\?:\s*\(pathname:\s*string,\s*href:\s*string\)\s*=>\s*boolean/,
  },
  {
    id: "prefers-reduced-motion",
    title: "prefers-reduced-motion neutralizes the visible animation classes",
    file: "app/globals.css",
    re: /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]{0,400}\.animate-enter-up[\s\S]{0,400}\.workspace-loader-dot[\s\S]{0,400}\.workspace-loader-ring/,
  },
  {
    id: "workspace-context-shell",
    title: "WorkspaceContextProvider exists and exports useWorkspaceContext",
    file: "components/WorkspaceContextProvider.tsx",
    re: /export\s+\{\s*useWorkspaceContext\s*\}/,
  },
  {
    id: "teacher-workspace-provider",
    title: "TeacherWorkspaceProvider wraps TeacherShell content",
    file: "components/TeacherShell.tsx",
    re: /TeacherWorkspaceProvider/,
  },
  {
    id: "tenant-context-helpers",
    title: "lib/tenant/tenant-context.ts exposes tenant helpers",
    file: "lib/tenant/tenant-context.ts",
    re: /export\s+function\s+(requireTenantId|tenantRateLimitScope|tenantActorRateLimitKey|withTenantFilter)\b/,
  },
  {
    id: "shell-navigation-aria",
    title: "All five role shells carry role=\"navigation\" aria-label=\"Primary\" on the sidebar",
    file: null, // checked across multiple files below
    re: /role="navigation"\s+aria-label="Primary"|aria-label="Primary"\s+role="navigation"/,
    multi: [
      "components/AdminShell.tsx",
      "components/ParentShell.tsx",
      "components/TeacherShell.tsx",
      "components/StudentShell.tsx",
      "components/PaymentsShell.tsx",
    ],
  },
  {
    id: "shell-skip-to-content",
    title: "All five role shells expose a skip-to-content link to #main",
    file: null,
    re: /href="#main"[\s\S]{0,1500}Skip to content/,
    multi: [
      "components/AdminShell.tsx",
      "components/ParentShell.tsx",
      "components/TeacherShell.tsx",
      "components/StudentShell.tsx",
      "components/PaymentsShell.tsx",
    ],
  },
  {
    id: "role-page-orchestrators",
    title: "Role-page orchestrators delegate to dashboard components",
    file: null,
    re: /(TeacherDashboard|ParentDashboard|StudentDashboard)/,
    multi: [
      "app/app/teacher/page.tsx",
      "app/app/parent/page.tsx",
      "app/app/student/page.tsx",
    ],
  },
];

const isJson = process.argv.includes("--json");

const results = [];
for (const inv of invariants) {
  const targets = inv.multi ?? (inv.file ? [inv.file] : []);
  const missing = [];
  for (const target of targets) {
    const path = resolve(ROOT, target);
    let source;
    try {
      source = await readFile(path, "utf8");
    } catch (err) {
      missing.push({ file: target, reason: `cannot read: ${err.message}` });
      continue;
    }
    if (!inv.re.test(source)) {
      missing.push({ file: target, reason: "invariant did not match" });
    }
  }
  results.push({
    id: inv.id,
    title: inv.title,
    targets,
    pass: missing.length === 0,
    missing,
  });
}

const totalPass = results.filter((r) => r.pass).length;
const totalFail = results.length - totalPass;

if (isJson) {
  process.stdout.write(JSON.stringify({ totalPass, totalFail, results }, null, 2) + "\n");
} else {
  process.stdout.write(`Audit refresh — true at ${new Date().toISOString()}\n\n`);
  for (const r of results) {
    const status = r.pass ? "PASS" : "FAIL";
    process.stdout.write(`[${status}] ${r.id}\n`);
    process.stdout.write(`        ${r.title}\n`);
    if (r.missing.length) {
      for (const m of r.missing) {
        process.stdout.write(`        - ${m.file}: ${m.reason}\n`);
      }
    }
  }
  process.stdout.write(`\nTotals: ${totalPass} pass · ${totalFail} fail\n`);
}

process.exit(totalFail === 0 ? 0 : 1);
