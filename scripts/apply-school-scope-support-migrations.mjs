/**
 * Apply school_id columns for idempotency_keys + user_devices if missing.
 * Uses Supabase Management API (SUPABASE_ACCESS_TOKEN in .env.local).
 *
 * Usage: node --env-file=.env.local scripts/apply-school-scope-support-migrations.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF?.trim() || "jnnroitaftfmclegbeac";

const token =
  process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
  process.env.SUPABASE_MGMT_TOKEN?.trim() ||
  "";

if (!token) {
  console.error("Set SUPABASE_ACCESS_TOKEN (or SUPABASE_MGMT_TOKEN) in .env.local");
  process.exit(1);
}

const migrations = [
  {
    version: "20260720120500",
    name: "20260720120500_idempotency_keys_school_scope",
    file: "supabase/migrations/20260720120500_idempotency_keys_school_scope.sql",
    verify: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'idempotency_keys'
        AND column_name = 'school_id'
    `,
  },
  {
    version: "20260720121000",
    name: "20260720121000_user_devices_school_scope",
    file: "supabase/migrations/20260720121000_user_devices_school_scope.sql",
    verify: `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_devices'
        AND column_name = 'school_id'
    `,
  },
];

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

function hasRows(result) {
  return Array.isArray(result) && result.length > 0;
}

await query("SELECT 1 AS ping");
console.log("DB connection OK\n");

for (const m of migrations) {
  const sql = readFileSync(resolve(m.file), "utf8").trim();
  console.log(`--- ${m.name} ---`);

  let already = false;
  try {
    const existing = await query(m.verify);
    already = hasRows(existing);
  } catch (err) {
    // Table may not exist yet — still try applying (CREATE/ALTER IF EXISTS).
    console.log(
      "Pre-check note:",
      String(err.message || err).slice(0, 160),
    );
  }

  if (already) {
    console.log("Already applied (school_id column present). Skipping SQL.");
  } else {
    await query(sql);
    console.log("SQL applied successfully.");
  }

  try {
    await query(
      `INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${m.version}') ON CONFLICT DO NOTHING`,
    );
    console.log("Recorded in schema_migrations.");
  } catch (err) {
    console.log(
      "Could not record migration metadata (SQL still applied if needed):",
      String(err.message || err).slice(0, 200),
    );
  }

  const verified = await query(m.verify);
  if (!hasRows(verified)) {
    console.error(`VERIFY FAILED: school_id missing after apply for ${m.name}`);
    process.exit(1);
  }
  console.log("Verified school_id column present.\n");
}

console.log("DONE school-scope support migrations");
