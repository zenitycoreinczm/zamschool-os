/**
 * Apply selected supabase/migrations/*.sql files via Management API,
 * then record them in supabase_migrations.schema_migrations.
 *
 * Usage:
 *   node scripts/apply-pending-supabase-migrations.mjs
 *   node scripts/apply-pending-supabase-migrations.mjs --dry-run
 *
 * Reads SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF from .env.local
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const ROOT = resolve(process.cwd());
const MIGRATIONS_DIR = resolve(ROOT, "supabase/migrations");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnvLocal();
const TOKEN =
  process.env.SUPABASE_ACCESS_TOKEN ||
  env.SUPABASE_ACCESS_TOKEN ||
  env.SUPABASE_MGMT_TOKEN;
const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_REF || "jnnroitaftfmclegbeac";

if (!TOKEN) {
  console.error("Missing SUPABASE_ACCESS_TOKEN in env or .env.local");
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

async function query(sql) {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data?.message
        ? data.message
        : String(text).slice(0, 500);
    throw new Error(`${res.status}: ${msg}`);
  }
  return data;
}

/** Migrations already known applied on remote under different names / content. */
const SKIP_VERSIONS = new Set([
  // baseline present under baseline_schema_20260618
  "00000000000000",
  // last_login / position already present on remote
  "20260627120000",
  "20260627120001",
  // role helper / registrar constraints largely applied via dashboard migrations
  "20260628170000",
]);

/** Prefer applying these for functional + security fixes. */
const PRIORITY = [
  "20260627143000_add_payment_transaction_rpcs.sql",
  "20260621120000_force_rls_all_tenant_tables.sql",
  "20260620123000_repair_principal_permissions.sql",
  "20260621130000_add_registrar_role_constraints.sql",
  "20260622100000_sync_school_staff_permission_groups.sql",
  "20260628160000_update_registrar_classes_permission.sql",
  "20260709000000_transfer_class_creation_to_registrar.sql",
  "20260709000001_ensure_academic_admin_timetable_permissions.sql",
  "20260709120000_backend_performance_indexes.sql",
  "20260709140000_collapse_admin_into_principal.sql",
];

function versionFromFilename(name) {
  return name.replace(/\.sql$/i, "").split("_")[0];
}

function migrationNameFromFilename(name) {
  // 20260627143000_add_payment_transaction_rpcs.sql -> add_payment_transaction_rpcs
  return name.replace(/\.sql$/i, "").replace(/^\d+_/, "");
}

async function ensureMigrationsTable() {
  await query(`
    CREATE SCHEMA IF NOT EXISTS supabase_migrations;
    CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
      version text PRIMARY KEY,
      name text,
      statements text[],
      created_by text,
      idempotency_key text,
      statements_applied int,
      rolled_back_at timestamptz
    );
  `);
}

async function listAppliedVersions() {
  try {
    const rows = await query(
      `SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version`,
    );
    const list = Array.isArray(rows) ? rows : [];
    return new Set(list.map((r) => String(r.version)));
  } catch {
    return new Set();
  }
}

async function recordMigration(version, name) {
  // Compatible with both simple and full schema_migrations shapes.
  await query(`
    INSERT INTO supabase_migrations.schema_migrations (version, name)
    VALUES ('${version.replace(/'/g, "''")}', '${name.replace(/'/g, "''")}')
    ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name;
  `);
}

async function main() {
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`Mode: ${dryRun ? "DRY RUN" : "APPLY"}`);
  console.log("");

  // connectivity
  const ping = await query("SELECT 1 AS ok");
  console.log("Connected:", JSON.stringify(ping));

  if (!dryRun) {
    await ensureMigrationsTable();
  }

  const applied = await listAppliedVersions();
  console.log(`Already recorded versions: ${applied.size}`);

  const filesOnDisk = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // Apply priority list first, then any other local files not skipped.
  const ordered = [
    ...PRIORITY.filter((f) => filesOnDisk.includes(f)),
    ...filesOnDisk.filter((f) => !PRIORITY.includes(f)),
  ];

  const results = [];

  for (const file of ordered) {
    const version = versionFromFilename(file);
    const name = migrationNameFromFilename(file);
    const path = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(path, "utf8").trim();

    if (SKIP_VERSIONS.has(version)) {
      console.log(`SKIP (content already on remote): ${file}`);
      // Still record if not recorded, for bookkeeping (except baseline).
      if (!dryRun && version !== "00000000000000" && !applied.has(version)) {
        try {
          await recordMigration(version, name);
          console.log(`  recorded ${version}`);
        } catch (e) {
          console.log(`  record failed: ${e.message?.slice(0, 120)}`);
        }
      }
      results.push({ file, status: "skipped_known" });
      continue;
    }

    if (applied.has(version)) {
      console.log(`SKIP (already recorded): ${file}`);
      results.push({ file, status: "already_recorded" });
      continue;
    }

    console.log(`\nAPPLY ${file} (${sql.length} chars)...`);
    if (dryRun) {
      results.push({ file, status: "dry_run" });
      continue;
    }

    try {
      await query(sql);
      await recordMigration(version, name);
      console.log(`  OK + recorded ${version}`);
      results.push({ file, status: "applied" });
    } catch (err) {
      const msg = String(err.message || err);
      // Idempotent index/column migrations may partially succeed; still try record if safe.
      if (
        /already exists/i.test(msg) ||
        /duplicate/i.test(msg) ||
        /does not exist/i.test(msg)
      ) {
        console.log(`  WARN (continuing): ${msg.slice(0, 200)}`);
        try {
          await recordMigration(version, name);
          console.log(`  recorded ${version} after warning`);
          results.push({ file, status: "applied_with_warning", error: msg.slice(0, 200) });
        } catch (e2) {
          results.push({ file, status: "failed", error: msg.slice(0, 300) });
          console.log(`  FAIL record: ${e2.message?.slice(0, 120)}`);
        }
      } else {
        console.log(`  FAIL: ${msg.slice(0, 400)}`);
        results.push({ file, status: "failed", error: msg.slice(0, 400) });
      }
    }
  }

  console.log("\n=== VERIFY ===");
  try {
    const rpcs = await query(`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND proname IN (
          'record_student_payment_transaction',
          'record_student_fee_payment_transaction'
        )
      ORDER BY 1
    `);
    console.log("Payment RPCs:", JSON.stringify(rpcs));
  } catch (e) {
    console.log("RPC verify failed:", e.message);
  }

  try {
    const force = await query(`
      SELECT
        count(*) FILTER (WHERE c.relforcerowsecurity)::int AS force_rls,
        count(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
        count(*)::int AS total
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `);
    console.log("RLS summary:", JSON.stringify(force));
  } catch (e) {
    console.log("RLS verify failed:", e.message);
  }

  try {
    const keyForce = await query(`
      SELECT c.relname, c.relforcerowsecurity AS force_rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN (
          'payments','student_fees','classes','messages','audit_logs','schools'
        )
      ORDER BY 1
    `);
    console.log("Key FORCE RLS:", JSON.stringify(keyForce));
  } catch (e) {
    console.log("Key FORCE verify failed:", e.message);
  }

  try {
    const migs = await query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      ORDER BY version DESC
      LIMIT 20
    `);
    console.log("Recent migrations:", JSON.stringify(migs));
  } catch (e) {
    console.log("Migrations list failed:", e.message);
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    console.log(`  ${r.status.padEnd(22)} ${r.file}${r.error ? " :: " + r.error.slice(0, 80) : ""}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
