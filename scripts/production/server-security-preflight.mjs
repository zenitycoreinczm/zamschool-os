/**
 * Data-center server security preflight for national multi-school deploys.
 * Usage: npm run security:server
 *
 * Checks env + connectivity without printing secrets.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const env = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

const env = { ...process.env, ...loadEnvLocal() };
const rows = [];

function ok(label, detail) {
  rows.push({ ok: true, label, detail });
}
function fail(label, detail) {
  rows.push({ ok: false, label, detail });
}
function warn(label, detail) {
  rows.push({ ok: null, label, detail });
}

function present(...keys) {
  return keys.every((k) => String(env[k] || "").trim().length > 0);
}

console.log("\n=== ZamSchool server security preflight (data-center) ===\n");

// Core secrets
if (present("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  ok("Supabase public client", "URL + anon key present");
} else {
  fail("Supabase public client", "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing");
}

if (present("SUPABASE_SERVICE_ROLE_KEY")) {
  if (env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    fail("Service role key", "SERVICE_ROLE must not equal ANON key");
  } else {
    ok("Service role key", "present and distinct from anon");
  }
} else {
  fail("Service role key", "SUPABASE_SERVICE_ROLE_KEY missing on server");
}

// Redis shield
if (present("UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN")) {
  try {
    const url = env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "");
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && String(body.result || "").toUpperCase() === "PONG") {
      ok("Upstash Redis", "PING OK — distributed bans & rate limits ready");
    } else {
      fail("Upstash Redis", `PING failed HTTP ${res.status}`);
    }
  } catch (e) {
    fail("Upstash Redis", e instanceof Error ? e.message : String(e));
  }
} else {
  fail(
    "Upstash Redis",
    "Required for national scale — set UPSTASH_REDIS_REST_URL + TOKEN",
  );
}

// Host / CORS lockdown
if (present("CORS_ALLOWED_ORIGINS") || present("NEXT_PUBLIC_APP_ORIGIN")) {
  ok(
    "CORS / app origin",
    env.CORS_ALLOWED_ORIGINS || env.NEXT_PUBLIC_APP_ORIGIN,
  );
} else {
  fail("CORS / app origin", "Set CORS_ALLOWED_ORIGINS or NEXT_PUBLIC_APP_ORIGIN");
}

if (present("ALLOWED_HOSTS") || present("NEXT_PUBLIC_APP_ORIGIN")) {
  ok(
    "Allowed hosts",
    env.ALLOWED_HOSTS || env.NEXT_PUBLIC_APP_ORIGIN || "(from app origin)",
  );
} else {
  warn(
    "Allowed hosts",
    "Set ALLOWED_HOSTS=app.yourdomain.zm for host-header protection",
  );
}

// Object storage off Supabase
if (present("R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")) {
  ok("Cloudflare R2", "credentials present — use for school file storage");
} else {
  warn("Cloudflare R2", "missing — files may hit Supabase Storage quotas");
}

// Edge gateway
if (present("NEXT_PUBLIC_GATEWAY_URL")) {
  ok("Gateway worker", env.NEXT_PUBLIC_GATEWAY_URL);
} else {
  warn(
    "Gateway worker",
    "Optional edge layer — set NEXT_PUBLIC_GATEWAY_URL after wrangler deploy",
  );
}

// Strict DC mode flags
if (env.ZAMSCHOOL_DC_MODE === "true") {
  ok("ZAMSCHOOL_DC_MODE", "enabled — production security posture");
} else {
  warn(
    "ZAMSCHOOL_DC_MODE",
    "Set ZAMSCHOOL_DC_MODE=true on production servers",
  );
}

if (env.ZAMSCHOOL_DC_STRICT === "true") {
  ok("ZAMSCHOOL_DC_STRICT", "enabled — refuse boot if gates fail");
} else {
  warn(
    "ZAMSCHOOL_DC_STRICT",
    "Optional: set true to refuse start when Redis/secrets missing",
  );
}

// OTP / email
if (present("OTP_SECRET") || present("SMTP_HOST")) {
  ok("OTP / SMTP", "at least one email path configured");
} else {
  warn("OTP / SMTP", "configure OTP_SECRET and SMTP for account recovery");
}

console.log("");
let fails = 0;
for (const row of rows) {
  const mark = row.ok === true ? "✓" : row.ok === false ? "✗" : "·";
  if (row.ok === false) fails += 1;
  console.log(`${mark} ${row.label}`);
  console.log(`  ${row.detail}\n`);
}

console.log("--- Summary ---");
console.log(
  fails === 0
    ? "Server security preflight: READY for multi-school data-center deploy."
    : `Server security preflight: ${fails} critical gap(s) — fix before national roll-out.`,
);
console.log("");

process.exit(fails > 0 ? 1 : 0);
