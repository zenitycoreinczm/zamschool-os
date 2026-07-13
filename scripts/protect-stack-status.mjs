/**
 * One-shot status for the Supabase protection stack:
 * Upstash Redis (required) + Cloudflare R2 (storage/CDN) + optional KV.
 *
 * Usage: node --env-file=.env.local ./scripts/protect-stack-status.mjs
 * Does not print secrets.
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal(path = ".env.local") {
  if (!existsSync(path)) {
    console.error(`${path} not found`);
    process.exit(1);
  }
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
function info(label, detail) {
  rows.push({ ok: null, label, detail });
}

// ─── Upstash Redis ───────────────────────────────────────────────────────────
const redisUrl = (env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const redisToken = env.UPSTASH_REDIS_REST_TOKEN || "";

if (!redisUrl || !redisToken) {
  fail(
    "Upstash Redis",
    "Missing UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN — login lockout & rate limits will not be distributed.",
  );
} else {
  try {
    const host = new URL(redisUrl).host;
    const res = await fetch(`${redisUrl}/ping`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && String(body.result || "").toUpperCase() === "PONG") {
      ok("Upstash Redis", `PING OK (${host}) — primary protection backend`);
    } else {
      fail("Upstash Redis", `HTTP ${res.status} — ${JSON.stringify(body)}`);
    }

    // Lightweight job smoke: SET/GET/DEL probe key
    const probe = `zamschool:protect:probe:${Date.now()}`;
    const setRes = await fetch(
      `${redisUrl}/set/${encodeURIComponent(probe)}/ok?EX=30`,
      { headers: { Authorization: `Bearer ${redisToken}` } },
    );
    const getRes = await fetch(
      `${redisUrl}/get/${encodeURIComponent(probe)}`,
      { headers: { Authorization: `Bearer ${redisToken}` } },
    );
    await fetch(`${redisUrl}/del/${encodeURIComponent(probe)}`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    if (setRes.ok && getRes.ok) {
      ok("Upstash write path", "SET/GET/DEL probe succeeded (rate limits & lockouts can persist)");
    } else {
      fail("Upstash write path", `SET ${setRes.status} GET ${getRes.status}`);
    }
  } catch (e) {
    fail("Upstash Redis", e instanceof Error ? e.message : String(e));
  }
}

// ─── Cloudflare R2 (uses your 10GB free storage for avatars/files) ───────────
const r2Endpoint = env.R2_ENDPOINT || "";
const r2Key = env.R2_ACCESS_KEY_ID || "";
const r2Secret = env.R2_SECRET_ACCESS_KEY || "";
const r2Public = (env.R2_PUBLIC_URL || env.NEXT_PUBLIC_R2_PUBLIC_URL || "").trim();

if (r2Endpoint && r2Key && r2Secret) {
  ok(
    "Cloudflare R2 credentials",
    "R2_ENDPOINT + access keys present (offload files from Supabase Storage)",
  );
} else {
  fail(
    "Cloudflare R2 credentials",
    "Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY so avatars/files use the 10GB R2 plan",
  );
}

if (r2Public.startsWith("https://") && r2Public.includes("r2.dev")) {
  ok("Cloudflare R2 public CDN", r2Public);
} else if (r2Public) {
  ok("Cloudflare R2 public CDN", r2Public);
} else {
  fail(
    "Cloudflare R2 public CDN",
    "R2_PUBLIC_URL unset — app will proxy assets (more origin load). Enable Public Development URL on zamschool-assets.",
  );
}

// ─── Cloudflare KV REST (optional secondary rate limit) ──────────────────────
const kvUrl = (env.KV_REST_API_URL || "").trim();
const kvToken = (env.KV_REST_API_TOKEN || "").trim();

if (!kvUrl || !kvToken) {
  info(
    "Cloudflare KV REST",
    "Not configured — OK if Upstash Redis is healthy (Redis is primary for rate limits).",
  );
} else if (!kvUrl.includes("api.cloudflare.com")) {
  fail(
    "Cloudflare KV REST",
    "KV_REST_API_URL must be https://api.cloudflare.com/client/v4/accounts/.../storage/kv/namespaces/...",
  );
} else {
  try {
    const probe = `protect-probe-${Date.now()}`;
    const put = await fetch(`${kvUrl}/values/${encodeURIComponent(probe)}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${kvToken}`,
        "Expiration-TTL": "60",
      },
      body: "1",
    });
    if (put.ok) {
      ok("Cloudflare KV REST", "Write OK — secondary rate-limit backend ready");
      await fetch(`${kvUrl}/values/${encodeURIComponent(probe)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${kvToken}` },
      }).catch(() => {});
    } else if (put.status === 401 || put.status === 403) {
      fail(
        "Cloudflare KV REST",
        `HTTP ${put.status} — create an API token with Account → Workers KV Storage → Edit, and remove IP allowlist blocks for this machine. Redis still protects the app.`,
      );
    } else {
      fail("Cloudflare KV REST", `HTTP ${put.status}`);
    }
  } catch (e) {
    fail("Cloudflare KV REST", e instanceof Error ? e.message : String(e));
  }
}

// ─── Gateway (optional edge worker) ──────────────────────────────────────────
if (env.NEXT_PUBLIC_GATEWAY_URL) {
  info("Gateway worker URL", env.NEXT_PUBLIC_GATEWAY_URL);
} else {
  info(
    "Gateway worker URL",
    "NEXT_PUBLIC_GATEWAY_URL unset — API traffic goes origin → Redis/hot-read → Supabase (fine for pilot).",
  );
}

// ─── Supabase reachability (should stay behind caches) ───────────────────────
const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim();
if (supabaseUrl) {
  try {
    const res = await fetch(supabaseUrl, { method: "HEAD", redirect: "manual" });
    ok(
      "Supabase reachable",
      `${new URL(supabaseUrl).host} HTTP ${res.status} — protect with Redis + R2, not open browser→DB traffic`,
    );
  } catch (e) {
    fail("Supabase reachable", e instanceof Error ? e.message : String(e));
  }
} else {
  fail("Supabase reachable", "NEXT_PUBLIC_SUPABASE_URL missing");
}

// ─── Report ──────────────────────────────────────────────────────────────────
console.log("\n=== ZamSchool protection stack status ===\n");
console.log(
  "Goal: Upstash + Cloudflare absorb login abuse, rate limits, shell/workspace,",
);
console.log("      sessions, and file CDN so Supabase free tier lasts.\n");

let hardFails = 0;
for (const row of rows) {
  const mark = row.ok === true ? "✓" : row.ok === false ? "✗" : "·";
  if (row.ok === false) hardFails += 1;
  console.log(`${mark} ${row.label}`);
  console.log(`  ${row.detail}\n`);
}

const redisOk = rows.some((r) => r.label === "Upstash Redis" && r.ok);
const r2Ok = rows.some((r) => r.label.startsWith("Cloudflare R2 credentials") && r.ok);

console.log("--- Summary ---");
console.log(
  redisOk
    ? "Upstash: ACTIVE (login lockout, rate limits, role/session/shell caches)"
    : "Upstash: BROKEN — fix before production",
);
console.log(
  r2Ok
    ? "Cloudflare R2: credentials present (use 10GB free storage for assets)"
    : "Cloudflare R2: incomplete — files may hit Supabase Storage / origin",
);
console.log(
  hardFails === 0
    ? "\nSTATUS: READY — protection stack is healthy enough for pilot.\n"
    : `\nSTATUS: ${hardFails} issue(s) — see ✗ rows above.\n`,
);

// Fail CI/hard only when Redis (primary protection) is down.
// KV/token issues are warnings while Redis is healthy.
if (!redisOk) process.exit(1);
process.exit(0);
