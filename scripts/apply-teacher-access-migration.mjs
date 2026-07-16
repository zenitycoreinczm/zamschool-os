/**
 * One-shot: apply 20260716000000_teacher_class_access_via_assignments.sql
 * to production Supabase via Management API.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const migrationFile = resolve(
  "supabase/migrations/20260716000000_teacher_class_access_via_assignments.sql",
);
const migrationName = "20260716000000_teacher_class_access_via_assignments";

const env = readFileSync(resolve(".env.local"), "utf8");
const tokenMatch = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
const token = tokenMatch?.[1]?.trim();
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const sql = readFileSync(migrationFile, "utf8").trim();
console.log(`Applying migration: ${migrationName} (${sql.length} chars)`);

async function query(q) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: q }),
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${text.slice(0, 800)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

await query("SELECT 1 AS ping");
console.log("DB connection OK");

await query(sql);
console.log("SQL applied successfully");

// Best-effort bookkeeping - schema differs across projects.
try {
  await query(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${migrationName}') ON CONFLICT DO NOTHING`,
  );
  console.log("Recorded in schema_migrations (version)");
} catch (err) {
  console.log(
    "Could not record migration metadata (SQL still applied):",
    String(err.message || err).slice(0, 200),
  );
}

const verify = await query(`
  SELECT proname
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND proname IN (
      'accessible_class_ids',
      'teacher_can_manage_class',
      'teacher_can_manage_class_subject',
      'teacher_has_class',
      'teacher_has_class_subject'
    )
  ORDER BY 1
`);

const names = Array.isArray(verify) ? verify.map((r) => r.proname) : [];
console.log("Verified functions:", names.join(", ") || String(verify));

const expected = [
  "accessible_class_ids",
  "teacher_can_manage_class",
  "teacher_can_manage_class_subject",
  "teacher_has_class",
  "teacher_has_class_subject",
];
const missing = expected.filter((n) => !names.includes(n));
if (missing.length) {
  console.error("Missing functions after apply:", missing.join(", "));
  process.exit(1);
}

console.log("DONE migration");
