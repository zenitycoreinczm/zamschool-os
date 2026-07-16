/**
 * Apply 20260716140000_fix_owner_delete_permissions.sql to production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const migrationName = "20260716140000_fix_owner_delete_permissions";
const sqlPath = resolve(`supabase/migrations/${migrationName}.sql`);

const env = readFileSync(resolve(".env.local"), "utf8");
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8").trim();

async function q(query) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 600)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

console.log("Applying owner delete permission repair…");
await q(sql);
console.log("SQL applied");

const verify = await q(`
  SELECT lower(pgr.role) AS role, pf.feature_key,
         pf.can_create, pf.can_update, pf.can_delete
  FROM permission_features pf
  JOIN permission_groups pg ON pg.id = pf.group_id
  JOIN permission_group_roles pgr ON pgr.group_id = pg.id
  WHERE pf.feature_key IN (
    'timetable','subjects','grades','assignments','terms','academic_years',
    'grading_scales','announcements','discipline','finance','payments','users','classes'
  )
    AND lower(pgr.role) IN (
      'academic_admin','principal','registrar','bursar','discipline_admin',
      'ict_admin','teacher','deputy_head'
    )
  ORDER BY role, pf.feature_key
`);
console.log("Sample verification rows:", JSON.stringify(verify, null, 2));

// Fail if academic_admin still cannot delete timetable/subjects
const blockers = (Array.isArray(verify) ? verify : []).filter(
  (r) =>
    r.role === "academic_admin" &&
    ["timetable", "subjects", "grades", "assignments", "terms"].includes(
      r.feature_key,
    ) &&
    r.can_delete !== true,
);
if (blockers.length) {
  console.error("Still blocked:", blockers);
  process.exit(1);
}

try {
  await q(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${migrationName}') ON CONFLICT DO NOTHING`,
  );
  console.log("Recorded migration version");
} catch (e) {
  console.log("Bookkeeping note:", String(e.message || e).slice(0, 120));
}

console.log("DONE");
