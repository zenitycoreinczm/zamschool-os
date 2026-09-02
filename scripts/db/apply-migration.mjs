/**
 * Apply one or more SQL migration files directly to the Supabase Postgres
 * instance. Complements `supabase db push` for environments where the CLI
 * is not authenticated.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db/apply-migration.mjs \
 *     supabase/migrations/<file>.sql [more.sql ...]
 *
 * Safety: each file runs inside a single transaction; a failure rolls back
 * that file and stops.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const [/* node */, /* script */, ...files] = process.argv;

if (!files.length) {
  console.error("Usage: node scripts/db/apply-migration.mjs <file.sql> [...]");
  process.exit(1);
}

const config = {
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
};

for (const key of ["host", "user", "password"]) {
  if (!config[key]) {
    console.error(`Missing SUPABASE_DB_${key.toUpperCase()} environment variable`);
    process.exit(1);
  }
}

/**
 * The direct `db.<ref>.supabase.co` endpoint is IPv6-only on most networks.
 * When that host fails to resolve, fall back to the shared Supabase pooler
 * (session mode) derived from the project ref.
 */
async function connectWithFallback() {
  const ref = String(config.host || "").split(".")[1] || process.env.SUPABASE_PROJECT_REF;
  const attempts = [
    { host: config.host, port: config.port, user: config.user },
    ref
      ? {
          host: "aws-1-eu-west-1.pooler.supabase.com",
          port: 5432,
          user: `postgres.${ref}`,
        }
      : null,
  ].filter(Boolean);

  for (const attempt of attempts) {
    try {
      const client = new pg.Client({ ...config, ...attempt });
      await client.connect();
      if (attempt.host !== config.host) {
        console.log(`Connected via pooler: ${attempt.host} (user ${attempt.user})`);
      }
      return client;
    } catch (error) {
      console.error(`Connection failed via ${attempt.host}: ${error.code || error.message}`);
    }
  }
  console.error("No working database connection.");
  process.exit(1);
}

const client = await connectWithFallback();

try {
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    const sql = readFileSync(path, "utf8");
    console.log(`\n=== Applying ${file} ===`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("COMMIT");
      console.log(`OK: ${file} applied.`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`FAILED: ${file} rolled back.`);
      console.error(error.message);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.end();
}
