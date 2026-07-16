/**
 * One-shot: grant registrar can_delete on users (and classes) in production.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "jnnroitaftfmclegbeac";
const sqlPath = resolve(
  "supabase/migrations/20260716120000_registrar_users_delete_permission.sql",
);

const env = readFileSync(resolve(".env.local"), "utf8");
const token = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m)?.[1]?.trim();
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8").trim();

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
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

console.log("Applying registrar delete permission SQL…");
await query(sql);
console.log("SQL applied");

const verify = await query(`
  SELECT pg.name AS group_name, pgr.role, pf.feature_key,
         pf.can_create, pf.can_read, pf.can_update, pf.can_delete
  FROM permission_features pf
  JOIN permission_groups pg ON pg.id = pf.group_id
  JOIN permission_group_roles pgr ON pgr.group_id = pg.id
  WHERE lower(pgr.role) = 'registrar'
    AND pf.feature_key IN ('users', 'classes')
  ORDER BY pf.feature_key
`);
console.log("Verified rows:", JSON.stringify(verify, null, 2));
console.log("DONE");
