/**
 * Live connectivity check for Upstash Redis REST using .env.local.
 * Does not print secrets.
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
  console.error("MISSING UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cmd(path, init) {
  const res = await fetch(`${url}${path}`, { headers, ...init });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const host = new URL(url).host;
const probeKey = `zamschool:agent:probe:${Date.now()}`;
const results = [];

const ping = await cmd("/ping");
results.push(["PING", ping.status, ping.body?.result ?? ping.body]);

const set = await cmd(`/set/${encodeURIComponent(probeKey)}?EX=30`, {
  method: "POST",
  body: JSON.stringify("connected"),
});
results.push(["SET", set.status, set.body?.result ?? set.body]);

const get = await cmd(`/get/${encodeURIComponent(probeKey)}`);
results.push(["GET", get.status, get.body?.result ?? get.body]);

const dbsize = await cmd("/dbsize");
results.push(["DBSIZE", dbsize.status, dbsize.body?.result ?? dbsize.body]);

const del = await cmd(`/del/${encodeURIComponent(probeKey)}`);
results.push(["DEL", del.status, del.body?.result ?? del.body]);

const ok =
  ping.status === 200 &&
  ping.body?.result === "PONG" &&
  set.status === 200 &&
  get.status === 200;

console.log("Upstash Redis REST connectivity");
console.log("  host:", host);
console.log("  url configured:", Boolean(url));
console.log("  token configured:", Boolean(token), `(len=${token.length})`);
for (const [name, status, result] of results) {
  console.log(`  ${name}: HTTP ${status} → ${JSON.stringify(result)}`);
}
console.log(ok ? "\nSTATUS: CONNECTED" : "\nSTATUS: FAILED");
process.exit(ok ? 0 : 1);
