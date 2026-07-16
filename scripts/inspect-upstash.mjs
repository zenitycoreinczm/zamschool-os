/**
 * Inventory keys in Upstash Redis REST (from .env.local).
 * Prints key names, types, TTLs; values only for small non-sensitive-looking keys.
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

async function redis(...parts) {
  // Upstash pipeline: POST /pipeline with [["CMD","a"],...]
  // Or single command path: /cmd/arg1/arg2
  const path = "/" + parts.map((p) => encodeURIComponent(String(p))).join("/");
  const res = await fetch(`${url}${path}`, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`${parts[0]} HTTP ${res.status}: ${JSON.stringify(body)}`);
  return body.result;
}

async function pipeline(commands) {
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers,
    body: JSON.stringify(commands),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`pipeline HTTP ${res.status}: ${JSON.stringify(body)}`);
  // body is array of {result} or {error}
  return body;
}

const host = new URL(url).host;
const ping = await redis("PING");
const dbsize = await redis("DBSIZE");

// SCAN all keys
const keys = [];
let cursor = "0";
do {
  // SCAN cursor COUNT 100
  const res = await fetch(`${url}/scan/${cursor}/COUNT/200`, { headers });
  const body = await res.json();
  if (!res.ok) throw new Error(`SCAN failed: ${JSON.stringify(body)}`);
  const [next, batch] = body.result;
  cursor = String(next);
  keys.push(...batch);
} while (cursor !== "0");

keys.sort((a, b) => a.localeCompare(b));

// TYPE + TTL per key via pipeline
const metaCmds = [];
for (const k of keys) {
  metaCmds.push(["TYPE", k], ["TTL", k], ["MEMORY", "USAGE", k]);
}
const meta = await pipeline(metaCmds);

const rows = [];
for (let i = 0; i < keys.length; i++) {
  const type = meta[i * 3]?.result ?? meta[i * 3]?.error ?? "?";
  const ttl = meta[i * 3 + 1]?.result ?? meta[i * 3 + 1]?.error ?? "?";
  const mem = meta[i * 3 + 2]?.result ?? meta[i * 3 + 2]?.error ?? null;
  rows.push({ key: keys[i], type, ttl, mem });
}

// Prefix summary
const prefixes = new Map();
for (const row of rows) {
  const p = row.key.includes(":")
    ? row.key.split(":").slice(0, 2).join(":")
    : row.key.split(/[:_-]/)[0] || row.key;
  prefixes.set(p, (prefixes.get(p) || 0) + 1);
}

function looksSensitive(key) {
  return /token|session|secret|password|auth|jwt|cookie|otp|mfa/i.test(key);
}

async function sampleValue(key, type) {
  if (looksSensitive(key)) return "(redacted - sensitive key name)";
  try {
    if (type === "string") {
      const v = await redis("GET", key);
      const s = v == null ? "null" : String(v);
      return s.length > 120 ? s.slice(0, 120) + "…" : s;
    }
    if (type === "hash") {
      const len = await redis("HLEN", key);
      const sample = await redis("HGETALL", key);
      // sample may be flat array
      const preview = JSON.stringify(sample).slice(0, 120);
      return `fields=${len} sample=${preview}${preview.length >= 120 ? "…" : ""}`;
    }
    if (type === "list") {
      const len = await redis("LLEN", key);
      const sample = await redis("LRANGE", key, 0, 2);
      return `len=${len} head=${JSON.stringify(sample).slice(0, 100)}`;
    }
    if (type === "set") {
      const len = await redis("SCARD", key);
      const sample = await redis("SRANDMEMBER", key, 3);
      return `card=${len} sample=${JSON.stringify(sample).slice(0, 100)}`;
    }
    if (type === "zset") {
      const len = await redis("ZCARD", key);
      const sample = await redis("ZRANGE", key, 0, 2, "WITHSCORES");
      return `card=${len} sample=${JSON.stringify(sample).slice(0, 100)}`;
    }
    return `(type ${type})`;
  } catch (e) {
    return `(read error: ${e.message})`;
  }
}

console.log("Upstash Redis inventory");
console.log("  host:", host);
console.log("  PING:", ping);
console.log("  DBSIZE:", dbsize);
console.log("  keys scanned:", keys.length);
console.log("");
console.log("Prefix counts:");
for (const [p, n] of [...prefixes.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${n.toString().padStart(3)}  ${p}`);
}
console.log("");
console.log("Keys:");
for (const row of rows) {
  const ttlLabel =
    row.ttl === -1
      ? "no-expiry"
      : row.ttl === -2
        ? "missing"
        : `ttl=${row.ttl}s`;
  const memLabel = typeof row.mem === "number" ? ` ~${row.mem}B` : "";
  const sample = await sampleValue(row.key, row.type);
  console.log(`  [${row.type}] ${row.key}`);
  console.log(`         ${ttlLabel}${memLabel}`);
  console.log(`         ${sample}`);
}
