/**
 * Cleanup stale Upstash Redis keys (from .env.local).
 *
 * Deletes keys that violate the free-tier invariant "every key must have a TTL":
 * any key under an approved app prefix (rl:, role:, sess:, tmp:, daily:, shell:, ws:)
 * whose TTL is -1 (no expiry) is stale — written by older code versions or by a
 * process that died between INCR and EXPIRE. Leftover keys bloat the database
 * and pollute DBSIZE.
 *
 * Keys outside approved prefixes (e.g. Upstash-internal `_upstash_agent-*`)
 * are never touched.
 *
 * Usage:
 *   node scripts/cleanup-upstash-stale-keys.mjs            # dry-run (default)
 *   node scripts/cleanup-upstash-stale-keys.mjs --apply    # actually delete
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal(path = ".env.local") {
  if (!existsSync(path)) throw new Error(`${path} not found`);
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

const APPLY = process.argv.includes("--apply");

const env = loadEnvLocal();
const url = (env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const token = env.UPSTASH_REDIS_REST_TOKEN || "";
if (!url || !token) {
  console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function scanAllKeys() {
  const keys = [];
  let cursor = "0";
  do {
    const res = await fetch(`${url}/scan/${cursor}/COUNT/200`, { headers });
    const body = await res.json();
    if (!res.ok) throw new Error(`SCAN failed: ${JSON.stringify(body)}`);
    const [next, batch] = body.result;
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

async function pipeline(commands) {
  const results = [];
  const BATCH = 500;
  for (let i = 0; i < commands.length; i += BATCH) {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers,
      body: JSON.stringify(commands.slice(i, i + BATCH)),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(`pipeline HTTP ${res.status}: ${JSON.stringify(body)}`);
    results.push(...body);
  }
  return results;
}

// Approved app prefixes (mirrors lib/redis/keys.ts REDIS_KEY_PREFIX).
const APP_PREFIXES = ["rl:", "role:", "sess:", "tmp:", "daily:", "shell:", "ws:"];

console.log(`Upstash stale-key cleanup (${APPLY ? "APPLY - deleting" : "dry-run"})`);
console.log("  host:", new URL(url).host);

const allKeys = await scanAllKeys();
const appKeys = allKeys.filter((k) => APP_PREFIXES.some((p) => k.startsWith(p)));
const foreign = allKeys.length - appKeys.length;
console.log(`  keys scanned: ${allKeys.length} (app: ${appKeys.length}, untouched foreign: ${foreign})`);

// TTL per key via pipeline
const ttlResults = await pipeline(appKeys.map((k) => ["TTL", k]));
const stale = [];
for (let i = 0; i < appKeys.length; i++) {
  const r = ttlResults[i];
  if (r && r.result === -1) stale.push(appKeys[i]);
}

// Prefix breakdown so the output explains WHERE the leak came from.
const byPrefix = new Map();
for (const k of stale) {
  const p = k.split(":").slice(0, 2).join(":");
  byPrefix.set(p, (byPrefix.get(p) || 0) + 1);
}

if (stale.length === 0) {
  console.log("\nNo stale (TTL=-1) app keys found. Database is clean.");
  process.exit(0);
}

console.log(`\nStale keys with NO expiry: ${stale.length}`);
for (const [p, n] of [...byPrefix.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(4)}  ${p}:*`);
}

if (!APPLY) {
  console.log("\nDry-run only. Re-run with --apply to delete these keys.");
  process.exit(0);
}

const delResults = await pipeline(stale.map((k) => ["DEL", k]));
const deleted = delResults.filter((r) => r.result >= 0).length;
const failed = delResults.filter((r) => r.error).length;
console.log(`\nDeleted ${deleted}/${stale.length} stale keys.${failed ? ` Failures: ${failed}` : ""}`);

// Verify
const dbsize = await (await fetch(`${url}/dbsize`, { headers })).json();
console.log("DBSIZE now:", dbsize.result);
