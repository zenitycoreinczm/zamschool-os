import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const env = readFileSync(resolve(".env.local"), "utf8");
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const sql = readFileSync(
  resolve(
    "supabase/migrations/20260716130000_academic_admin_timetable_delete.sql",
  ),
  "utf8",
).trim();

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
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

console.log("Applying academic admin timetable delete permission…");
await q(sql);
console.log("SQL applied");

const verify = await q(`
  SELECT pgr.role, pf.feature_key, pf.can_create, pf.can_read, pf.can_update, pf.can_delete
  FROM permission_features pf
  JOIN permission_groups pg ON pg.id = pf.group_id
  JOIN permission_group_roles pgr ON pgr.group_id = pg.id
  WHERE pf.feature_key = 'timetable'
    AND lower(pgr.role) IN ('academic_admin', 'principal', 'deputy_head')
  ORDER BY pgr.role
`);
console.log("Verified:", JSON.stringify(verify, null, 2));

try {
  await q(
    `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260716130000_academic_admin_timetable_delete') ON CONFLICT DO NOTHING`,
  );
  console.log("Recorded migration version");
} catch (e) {
  console.log("Migration bookkeeping note:", String(e.message || e).slice(0, 120));
}
