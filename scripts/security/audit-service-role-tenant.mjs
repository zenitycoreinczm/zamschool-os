/**
 * Static audit: supabaseAdmin.from(...) calls should scope tenant data by school_id
 * (or another documented exception).
 *
 * Usage: node scripts/security/audit-service-role-tenant.mjs [--strict]
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const STRICT = process.argv.includes("--strict");
const ROOT = join(process.cwd());
const SCAN_DIRS = ["app/api", "lib"];

/** Tables that are global or located before school exists. */
const GLOBAL_TABLES = new Set([
  "schools",
  "access_codes",
  "auth.users",
  "temp_tokens",
]);

/** Lookup by primary key after invitation/token flows. */
const TOKEN_SCOPED_TABLES = new Set(["staff_invitations"]);

const TENANT_SCOPED_HINT =
  /school_id|schoolId|school_id:\s*schoolId|requireActorContext|requireAdminContext|requireTeacherContext|requireStudentContext|requireParentContext|requirePaymentsContext|requireFinancial|requireSuperAdminContext|requireSchoolStaffContext|profileIdentityOrFilter|loadNotificationsForUser|getUnreadCountsForUser|countUnreadNotificationsForUser|authenticateAccountPortalRequest|\.eq\("id",|\.in\("id",|\.in\("student_id",|\.eq\("assignment_id",|school_id:\s*access/i;

const FROM_RE = /supabaseAdmin\s*\.\s*from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;

/** Documented exceptions: cross-tenant lookups that are safe by design. */
const DOCUMENTED_EXCEPTIONS = [
  { file: "app/api/auth/forgot-password/route.ts", table: "profiles", reason: "Cross-tenant email lookup for password reset (no school context)" },
  { file: "app/api/staff/invitations/route.ts", table: "staff_invitations", reason: "Insert only - scoped via payload's school_id/created_by/invited_by/accepted_by rather than an `.eq()` chain. Heuristic flagged it because its scan window doesn't see the insert payload." },
];

function listTsFiles(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = prefix ? `${prefix}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full, rel));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push({ full, rel });
    }
  }
  return out;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function classify(table, windowText, fileRel) {
  if (GLOBAL_TABLES.has(table)) {
    return { level: "ok", reason: "global table" };
  }

  // Check documented exceptions
  const exc = DOCUMENTED_EXCEPTIONS.find(e => e.file === fileRel && e.table === table);
  if (exc) {
    return { level: "ok", reason: `documented exception: ${exc.reason}` };
  }

  if (TOKEN_SCOPED_TABLES.has(table)) {
    if (
      /\.eq\(\s*["'`]token["'`]/.test(windowText) ||
      /\.eq\(\s*["'`]id["'`]/.test(windowText) ||
      /\.eq\(\s*["'`]school_id["'`]/.test(windowText)
    ) {
      return { level: "ok", reason: "token/id/school scoped lookup" };
    }
    return { level: "review", reason: "staff_invitations without token/id filter" };
  }

  if (table === "email_verifications") {
    return { level: "ok", reason: "pre-registration email verification (no school yet)" };
  }
  if (TENANT_SCOPED_HINT.test(windowText)) {
    return { level: "ok", reason: "tenant guard signal in window" };
  }
  if (fileRel.includes("super-admin")) {
    return { level: "review", reason: "super-admin route - verify intentional cross-tenant access" };
  }
  return { level: STRICT ? "fail" : "review", reason: "no school_id guard detected in scan window" };
}

function auditFile({ full, rel }) {
  const source = readFileSync(full, "utf8");
  if (!source.includes("supabaseAdmin")) {
    return [];
  }

  const findings = [];
  for (const match of source.matchAll(FROM_RE)) {
    const table = match[1];
    const index = match.index ?? 0;
    const line = lineNumberAt(source, index);
    const windowText = source.slice(Math.max(0, index - 600), index + 900);
    const result = classify(table, windowText, rel);
    if (result.level !== "ok") {
      findings.push({
        file: rel,
        line,
        table,
        level: result.level,
        reason: result.reason,
      });
    }
  }
  return findings;
}

const allFindings = [];
for (const dir of SCAN_DIRS) {
  const base = join(ROOT, dir);
  try {
    for (const file of listTsFiles(base, dir.replace(/\\/g, "/"))) {
      allFindings.push(...auditFile(file));
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

const fails = allFindings.filter((f) => f.level === "fail");
const reviews = allFindings.filter((f) => f.level === "review");

console.log("=== ZamSchool service-role tenant audit ===\n");
console.log(`Scanned: ${SCAN_DIRS.join(", ")}`);
console.log(`Findings: ${allFindings.length} (${fails.length} fail, ${reviews.length} review)\n`);

if (fails.length) {
  console.log("--- FAIL (no tenant signal in scan window) ---");
  for (const f of fails) {
    console.log(`${f.file}:${f.line}  table=${f.table}  ${f.reason}`);
  }
  console.log("");
}

if (reviews.length) {
  console.log("--- REVIEW (manual confirmation required) ---");
  for (const f of reviews) {
    console.log(`${f.file}:${f.line}  table=${f.table}  ${f.reason}`);
  }
  console.log("");
}

if (!allFindings.length) {
  console.log("No unscoped supabaseAdmin.from calls detected by static heuristics.");
}

const reportPath = join(ROOT, "docs", "SERVICE_ROLE_TENANT_AUDIT.md");
const report = buildReport(allFindings);
import { writeFileSync } from "node:fs";
writeFileSync(reportPath, report, "utf8");
console.log(`Report written: ${relative(ROOT, reportPath)}`);

process.exit(fails.length ? 1 : 0);

function buildReport(findings) {
  const date = new Date().toISOString().slice(0, 10);
  let md = `# Service-role tenant isolation audit\n\n`;
  md += `**Generated:** ${date}  \n`;
  md += `**Command:** \`node scripts/security/audit-service-role-tenant.mjs\`\n\n`;
  md += `This report lists \`supabaseAdmin.from(...)\` calls where a \`school_id\` (or documented exception) was **not** detected in the static scan window.\n\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  md += `| Fail | ${findings.filter((f) => f.level === "fail").length} |\n`;
  md += `| Review | ${findings.filter((f) => f.level === "review").length} |\n\n`;

  if (!findings.length) {
    md += `_No findings - all scanned calls matched tenant guard heuristics._\n\n`;
  } else {
    md += `## Findings\n\n| File | Line | Table | Level | Reason |\n|------|------|-------|-------|--------|\n`;
    for (const f of findings) {
      md += `| \`${f.file}\` | ${f.line} | \`${f.table}\` | ${f.level} | ${f.reason} |\n`;
    }
    md += `\n`;
  }

  md += `## Exceptions (by design)\n\n`;
  md += `- **Global tables:** \`${[...GLOBAL_TABLES].join("`, `")}\`\n`;
  md += `- **Token flows:** \`${[...TOKEN_SCOPED_TABLES].join("`, `")}\` with \`.eq('token')\` or invitation id\n`;
  md += `- **Auth admin:** \`supabaseAdmin.auth.*\` (not scanned)\n`;
  md += `- **Idempotency:** \`idempotency_keys\` filtered by \`school_id\` + route/scope/key (service-role only)\n\n`;
  md += `## Checklist\n\n`;
  md += `- [ ] Confirm each **review** row is safe or add \`.eq('school_id', schoolId)\`\n`;
  md += `- [ ] Re-run with \`--strict\` before production sign-off\n`;
  return md;
}
