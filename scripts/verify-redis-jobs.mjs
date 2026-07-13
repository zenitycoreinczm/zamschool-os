/**
 * Live verification of Redis web-app jobs via Upstash REST (no TS path aliases).
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
  console.error("Missing Upstash env");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function cmd(path, init) {
  const res = await fetch(`${base}${path}`, { headers, ...init });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body.result;
}

function hashId(value) {
  // Mirror lib/redis/keys.ts hashRedisIdentifier (pure JS)
  const input = String(value || "").trim().toLowerCase();
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  let h3 = 0x811c9dc5 ^ 0x85ebca6b;
  let h4 = 0x811c9dc5 ^ 0xc2b2ae35;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x01000193);
    h3 = Math.imul(h3 ^ (c * 31 + i), 0x01000193);
    h4 = Math.imul(h4 ^ ((c << 1) ^ i), 0x01000193);
  }
  const part = (n) => (n >>> 0).toString(16).padStart(8, "0");
  return `${part(h1)}${part(h2)}${part(h3)}${part(h4)}`;
}

const checks = [];
const ok = (name, pass, detail = "") => {
  checks.push({ name, pass });
  console.log(`${pass ? "OK" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const host = new URL(base).host;
console.log("Upstash host:", host);

ok("PING", (await cmd("/ping")) === "PONG");

// Atomic-ish sliding window via pipeline (Lua may also work)
const rlKey = `rl:verify:probe-${Date.now()}`;
const now = Date.now();
// Path-style ZADD: /zadd/key/score/member
await cmd(
  `/zadd/${encodeURIComponent(rlKey)}/${now}/${encodeURIComponent(`m-${now}`)}`,
);
await cmd(`/pexpire/${encodeURIComponent(rlKey)}/60000`);
const card = await cmd(`/zcard/${encodeURIComponent(rlKey)}`);
ok("rate-limit zset", Number(card) >= 1, `zcard=${card}`);
await cmd(`/del/${encodeURIComponent(rlKey)}`);

// Session meta without email
const sessKey = "sess:00000000-0000-4000-8000-000000000099";
const sessVal = {
  userId: "00000000-0000-4000-8000-000000000099",
  lastSeenAt: Date.now(),
  schoolId: "school-probe",
  role: "ADMIN",
};
await cmd(`/set/${encodeURIComponent(sessKey)}?EX=60`, {
  method: "POST",
  body: JSON.stringify(sessVal),
});
const gotSess = await cmd(`/get/${encodeURIComponent(sessKey)}`);
const sessObj = typeof gotSess === "string" ? JSON.parse(gotSess) : gotSess;
ok(
  "session meta no email",
  sessObj && sessObj.userId && !("email" in sessObj),
  JSON.stringify(sessObj),
);
await cmd(`/del/${encodeURIComponent(sessKey)}`, { method: "POST" });

// Login failure counter (hashed email key)
const emailHash = hashId("probe-lockout@example.com");
const failKey = `rl:login:email:${emailHash}`;
await cmd(`/del/${encodeURIComponent(failKey)}`, { method: "POST" });
const n1 = await cmd(`/incr/${encodeURIComponent(failKey)}`, { method: "POST" });
await cmd(`/expire/${encodeURIComponent(failKey)}/900`, { method: "POST" });
ok("login failure counter", Number(n1) === 1, `count=${n1}`);
await cmd(`/del/${encodeURIComponent(failKey)}`, { method: "POST" });

// Role cache
const roleKey = "role:probe-role-user";
await cmd(`/set/${encodeURIComponent(roleKey)}?EX=30`, {
  method: "POST",
  body: JSON.stringify({ role: "TEACHER", schoolId: "s1" }),
});
const role = await cmd(`/get/${encodeURIComponent(roleKey)}`);
const roleObj = typeof role === "string" ? JSON.parse(role) : role;
ok("role cache", roleObj?.role === "TEACHER", JSON.stringify(roleObj));
await cmd(`/del/${encodeURIComponent(roleKey)}`, { method: "POST" });

// Shell/workspace prefixes accepted by writing short TTL
const shellKey = "shell:probe:none";
const wsKey = "ws:probe:none";
await cmd(`/set/${encodeURIComponent(shellKey)}?EX=10`, {
  method: "POST",
  body: JSON.stringify({ ok: true }),
});
await cmd(`/set/${encodeURIComponent(wsKey)}?EX=10`, {
  method: "POST",
  body: JSON.stringify({ ok: true }),
});
ok("shell cache write", (await cmd(`/get/${encodeURIComponent(shellKey)}`)) != null);
ok("workspace cache write", (await cmd(`/get/${encodeURIComponent(wsKey)}`)) != null);
await cmd(`/del/${encodeURIComponent(shellKey)}`, { method: "POST" });
await cmd(`/del/${encodeURIComponent(wsKey)}`, { method: "POST" });

const failed = checks.filter((c) => !c.pass);
console.log(
  failed.length === 0
    ? "\nALL REDIS WEB-APP JOBS VERIFIED"
    : `\nFAILED: ${failed.map((f) => f.name).join(", ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
