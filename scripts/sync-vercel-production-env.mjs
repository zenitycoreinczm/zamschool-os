/**
 * Sync critical production env from .env.local → Vercel Production.
 * Public origins are forced to the live site (not localhost).
 *
 * Usage: node --env-file=.env.local ./scripts/sync-vercel-production-env.mjs
 */
import { spawnSync } from "node:child_process";

const LIVE_ORIGIN = "https://www.zamschoolos.site";
const LIVE_HOSTS = "www.zamschoolos.site,zamschoolos.site";
const CORS =
  "https://www.zamschoolos.site,https://zamschoolos.site";

/** @type {Record<string, string>} */
const forced = {
  ALLOWED_HOSTS: LIVE_HOSTS,
  CORS_ALLOWED_ORIGINS: CORS,
  NEXT_PUBLIC_APP_ORIGIN: LIVE_ORIGIN,
  NEXT_PUBLIC_APP_URL: LIVE_ORIGIN,
  NEXT_PUBLIC_WEBAPP_ORIGIN: LIVE_ORIGIN,
  NEXT_PUBLIC_WEB_ORIGIN: LIVE_ORIGIN,
  NEXT_PUBLIC_WEBAPP_PREVIEW_ORIGIN: LIVE_ORIGIN,
  EXPO_PUBLIC_WEBAPP_ORIGIN: LIVE_ORIGIN,
  EXPO_PUBLIC_WEBAPP_PREVIEW_ORIGIN: LIVE_ORIGIN,
  // Hard production posture
  ZAMSCHOOL_DC_MODE: "true",
  ZAMSCHOOL_DC_STRICT: "false",
  ALLOW_VERCEL_PREVIEW_HOSTS: "false",
  ENABLE_UNSAFE_DEV_ROUTES: "false",
  NEXT_PUBLIC_DISABLE_SUPABASE_GUARD: "false",
  ZAMSCHOOL_FREE_TIER: "true",
  CSP_PRODUCTION: "true",
};

/** Keys copied from local env when present (secrets / infrastructure). */
const fromLocal = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_ASSETS_BUCKET",
  "R2_UPLOADS_BUCKET",
  "R2_PUBLIC_URL",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
  "CF_ACCOUNT_ID",
  "CF_API_TOKEN",
  "CLOUDFLARE_IMAGES_ACCOUNT_ID",
  "CLOUDFLARE_IMAGES_TOKEN",
  "CLOUDFLARE_KV_ACCOUNT_ID",
  "CLOUDFLARE_KV_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];

/** Optional: do NOT put DB password / management tokens on the web runtime by default. */
const skipOnWebRuntime = new Set([
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_DB_USER",
  "SUPABASE_DB_HOST",
  "SUPABASE_DB_PORT",
  "SUPABASE_DB_NAME",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_MGMT_TOKEN",
]);

function clean(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

const PUBLIC_KEYS = new Set([
  "ALLOWED_HOSTS",
  "CORS_ALLOWED_ORIGINS",
  "NEXT_PUBLIC_APP_ORIGIN",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_WEBAPP_ORIGIN",
  "NEXT_PUBLIC_WEB_ORIGIN",
  "NEXT_PUBLIC_WEBAPP_PREVIEW_ORIGIN",
  "EXPO_PUBLIC_WEBAPP_ORIGIN",
  "EXPO_PUBLIC_WEBAPP_PREVIEW_ORIGIN",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
  "R2_PUBLIC_URL",
  "ZAMSCHOOL_DC_MODE",
  "ZAMSCHOOL_DC_STRICT",
  "ALLOW_VERCEL_PREVIEW_HOSTS",
  "ENABLE_UNSAFE_DEV_ROUTES",
  "NEXT_PUBLIC_DISABLE_SUPABASE_GUARD",
  "ZAMSCHOOL_FREE_TIER",
  "CSP_PRODUCTION",
]);

function setEnv(name, value, environment = "production") {
  const v = clean(value);
  if (!v) {
    console.log(`skip ${name} (empty)`);
    return false;
  }

  const sensitivity = PUBLIC_KEYS.has(name) ? "--no-sensitive" : "--sensitive";

  const result = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      name,
      environment,
      "--value",
      v,
      "--yes",
      "--force",
      sensitivity,
    ],
    {
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  if (result.status === 0) {
    console.log(`ok   ${name} → ${environment}`);
    return true;
  }

  console.error(
    `fail ${name}: ${(result.stderr || result.stdout || "").slice(0, 200)}`,
  );
  return false;
}

let ok = 0;
let fail = 0;

console.log("=== Sync production security env → Vercel ===\n");

for (const [name, value] of Object.entries(forced)) {
  if (setEnv(name, value)) ok += 1;
  else fail += 1;
}

for (const name of fromLocal) {
  if (skipOnWebRuntime.has(name)) continue;
  const value = process.env[name];
  if (setEnv(name, value)) ok += 1;
  else fail += 1;
}

// Preview gets same secrets + allow vercel.app hosts for previews
console.log("\n=== Preview targets (same infra, preview hosts allowed) ===\n");
const previewForced = {
  ...forced,
  ALLOW_VERCEL_PREVIEW_HOSTS: "true",
  // Preview still serves custom domain tests
  ZAMSCHOOL_DC_MODE: "true",
};

for (const [name, value] of Object.entries(previewForced)) {
  if (setEnv(name, value, "preview")) ok += 1;
  else fail += 1;
}

for (const name of fromLocal) {
  if (skipOnWebRuntime.has(name)) continue;
  if (setEnv(name, process.env[name], "preview")) ok += 1;
  else fail += 1;
}

console.log(`\nDone. ok=${ok} fail=${fail}`);
if (fail > 0) process.exitCode = 1;
