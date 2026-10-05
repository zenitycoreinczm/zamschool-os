import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { importTsDefault } from "../../../scripts/test-ts-module.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const queueMod = await importTsDefault("./queue.ts", import.meta.url);
const proxyMod = await importTsDefault("./proxy.ts", import.meta.url);
const { SchoolSyncQueue } = queueMod;
const { handleCachedProxy } = proxyMod;

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function unsignedJwt(exp) {
  return `Bearer ${b64url({ alg: "none" })}.${b64url({ exp })}.sig`;
}

function createDoStorage() {
  const map = new Map();
  return {
    map,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

function queuedItem(overrides = {}) {
  return {
    id: "q-1",
    schoolId: "school-1",
    userId: "user-1",
    method: "POST",
    path: "/api/teacher/attendance",
    body: { statuses: [{ studentId: "s-1", status: "PRESENT" }] },
    timestamp: Date.now(),
    ...overrides,
  };
}

test("queue replay never escalates to service-role (source guard)", async () => {
  const source = await readFile(resolve(here, "queue.ts"), "utf8");
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(source, /X-Queue-Replay-Escalated/);
});

test("flush with expired token replays the original bearer, never service-role", async () => {
  const storage = createDoStorage();
  const expired = unsignedJwt(Math.floor(Date.now() / 1000) - 3600);
  await storage.put("queue", [queuedItem({ authHeader: expired })]);

  const seenAuth = [];
  const env = {
    UPSTREAM_API: "https://app.example.test",
    // Even when the secret is configured, it must not be used for replay.
    SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key",
    fetch: async (req) => {
      seenAuth.push(req.headers.get("Authorization"));
      return new Response(JSON.stringify({ ok: true }), { status: 401 });
    },
  };

  const stub = new SchoolSyncQueue({ storage }, env);
  await stub.fetch(
    new Request("http://do/flush", { method: "POST" }),
  );

  assert.equal(seenAuth.length, 1);
  assert.equal(seenAuth[0], expired);
  // 401 → dead-lettered, not retained.
  assert.equal(storage.map.has("queue"), false);
});

test("flush with a valid token replays it and clears the queue on success", async () => {
  const storage = createDoStorage();
  const valid = unsignedJwt(Math.floor(Date.now() / 1000) + 3600);
  await storage.put("queue", [queuedItem({ authHeader: valid })]);

  const seenAuth = [];
  const env = {
    UPSTREAM_API: "https://app.example.test",
    fetch: async (req) => {
      seenAuth.push(req.headers.get("Authorization"));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  };

  const stub = new SchoolSyncQueue({ storage }, env);
  const res = await stub.fetch(new Request("http://do/flush", { method: "POST" }));

  assert.equal(res.status, 200);
  assert.deepEqual(seenAuth, [valid]);
  assert.equal(storage.map.has("queue"), false);
});

test("flush drops tokenless items without calling upstream", async () => {
  const storage = createDoStorage();
  await storage.put("queue", [queuedItem({ authHeader: undefined })]);

  let upstreamCalls = 0;
  const env = {
    UPSTREAM_API: "https://app.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "super-secret-service-key",
    fetch: async () => {
      upstreamCalls += 1;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  };

  const stub = new SchoolSyncQueue({ storage }, env);
  await stub.fetch(new Request("http://do/flush", { method: "POST" }));

  assert.equal(upstreamCalls, 0);
  assert.equal(storage.map.has("queue"), false);
});

function cacheMock() {
  globalThis.caches = {
    default: {
      async match() {
        return null;
      },
      async put() {},
    },
  };
}

test("cached proxy uses the fallback origin for GET reads when primary is 5xx", async () => {
  cacheMock();
  const seenHosts = [];
  const env = {
    UPSTREAM_API: "https://primary.example.test",
    UPSTREAM_API_FALLBACK: "https://fallback.example.test",
    fetch: async (req) => {
      const host = new URL(req.url).host;
      seenHosts.push(host);
      if (host === "primary.example.test") {
        return new Response("Bad Gateway", { status: 502 });
      }
      return Response.json(
        { success: true, from: "fallback" },
        { headers: { "Cache-Control": "private, max-age=60" } },
      );
    },
  };

  const url = new URL("https://gateway.example.test/api/dashboard/summary");
  const res = await handleCachedProxy(
    new Request(url.toString(), {
      headers: { Authorization: "Bearer user-token" },
    }),
    env,
    url,
  );

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { success: true, from: "fallback" });
  assert.equal(res.headers.get("X-Edge-Upstream"), "fallback");
  assert.deepEqual(seenHosts, ["primary.example.test", "fallback.example.test"]);
});

test("cached proxy keeps single-origin behavior when no fallback is configured", async () => {
  cacheMock();
  let upstreamCalls = 0;
  const env = {
    UPSTREAM_API: "https://primary.example.test",
    fetch: async () => {
      upstreamCalls += 1;
      return new Response("Bad Gateway", { status: 502 });
    },
  };

  const url = new URL("https://gateway.example.test/api/dashboard/summary");
  const res = await handleCachedProxy(
    new Request(url.toString(), {
      headers: { Authorization: "Bearer user-token" },
    }),
    env,
    url,
  );

  assert.equal(res.status, 503);
  assert.equal(upstreamCalls, 1);
});
