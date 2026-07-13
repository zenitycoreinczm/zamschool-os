/**
 * One-shot: scrub PII from existing sess:* keys in Upstash.
 * - Drops `email` / `userAgent` fields
 * - Keeps userId, lastSeenAt, optional schoolId/role
 * - Refreshes TTL to 24h (new policy)
 */
import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal(path = ".env.local") {
  if (!existsSync(path)) throw new Error(`${path} not found`);
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const base = (process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const token = process.env.UPSTASH_REDIS_REST_TOKEN || "";
if (!base || !token) {
  console.error("Missing UPSTASH_REDIS_REST_URL / TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function redis(path, init) {
  const res = await fetch(`${base}${path}`, { headers, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  }
  return body.result;
}

const SESSION_TTL_SEC = 24 * 60 * 60;

async function scanAll(match = "sess:*") {
  const keys = [];
  let cursor = "0";
  do {
    // SCAN cursor MATCH pattern COUNT n
    const path = `/scan/${cursor}/MATCH/${encodeURIComponent(match)}/COUNT/100`;
    const result = await redis(path);
    const [next, batch] = result;
    cursor = String(next);
    keys.push(...batch);
  } while (cursor !== "0");
  return keys;
}

function scrub(raw) {
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "not-json", value: null };
    }
  }
  if (!obj || typeof obj !== "object") {
    return { ok: false, reason: "not-object", value: null };
  }

  const hadPii = "email" in obj || "userAgent" in obj;
  const next = {
    userId: String(obj.userId || "").trim(),
    lastSeenAt: Number(obj.lastSeenAt) || Date.now(),
  };
  if (obj.schoolId != null) next.schoolId = obj.schoolId;
  if (obj.role != null) next.role = obj.role;
  if (obj.uaHash != null) next.uaHash = obj.uaHash;

  if (!next.userId) {
    return { ok: false, reason: "missing-userId", value: null };
  }

  return { ok: true, hadPii, value: next };
}

const keys = await scanAll("sess:*");
console.log(`Found ${keys.length} session key(s)`);

let rewritten = 0;
let deleted = 0;
let clean = 0;

for (const key of keys) {
  const raw = await redis(`/get/${encodeURIComponent(key)}`);
  const result = scrub(raw);

  if (!result.ok) {
    console.log(`  DEL  ${key} (${result.reason})`);
    await redis(`/del/${encodeURIComponent(key)}`);
    deleted += 1;
    continue;
  }

  if (!result.hadPii) {
    // Still refresh TTL to new policy
    await redis(`/set/${encodeURIComponent(key)}?EX=${SESSION_TTL_SEC}`, {
      method: "POST",
      body: JSON.stringify(result.value),
    });
    clean += 1;
    console.log(`  OK   ${key} (already clean, TTL refreshed)`);
    continue;
  }

  await redis(`/set/${encodeURIComponent(key)}?EX=${SESSION_TTL_SEC}`, {
    method: "POST",
    body: JSON.stringify(result.value),
  });
  rewritten += 1;
  console.log(`  FIX  ${key} (removed PII, TTL 24h)`);
}

console.log("");
console.log("Summary:");
console.log(`  rewritten (PII scrubbed): ${rewritten}`);
console.log(`  already clean:            ${clean}`);
console.log(`  deleted (invalid):        ${deleted}`);
console.log(`  total:                    ${keys.length}`);

// Verify no emails remain
const after = await scanAll("sess:*");
let stillPii = 0;
for (const key of after) {
  const raw = await redis(`/get/${encodeURIComponent(key)}`);
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (/"email"\s*:/.test(text) || text.includes("@")) {
    stillPii += 1;
    console.log(`  WARN still looks like PII: ${key}`);
  }
}

if (stillPii === 0) {
  console.log("\nPASS: no email PII left in sess:* keys");
  process.exit(0);
}

console.error(`\nFAIL: ${stillPii} key(s) still look like they contain PII`);
process.exit(1);
