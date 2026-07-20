import test from "node:test";
import assert from "node:assert/strict";

import { importTsDefault } from "../../../scripts/test-ts-module.mjs";

const worker = await importTsDefault("./index.ts", import.meta.url);

function createBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, options) {
      objects.set(key, { value, options });
    },
    async get(key) {
      const object = objects.get(key);
      if (!object) return null;
      return {
        body: object.value,
        httpMetadata: object.options?.httpMetadata,
      };
    },
  };
}

function createEnv(upstreamHandler) {
  const assets = createBucket();
  const uploads = createBucket();
  return {
    ASSETS_BUCKET: assets,
    UPLOADS_BUCKET: uploads,
    UPSTREAM_API: "https://app.example.test",
    CORS_ALLOWED_ORIGINS: "https://school.example.test",
    fetch: upstreamHandler,
    __assets: assets,
    __uploads: uploads,
  };
}

function createSessionEnv(upstreamHandler) {
  const env = createEnv(upstreamHandler);
  const sessions = new Map();
  env.SESSION_CACHE = {
    async get(key) {
      return sessions.get(key) || null;
    },
    async put(key, value) {
      sessions.set(key, JSON.parse(value));
    },
  };
  env.SUPABASE_JWT_SECRET = "test-secret";
  env.SUPABASE_JWT_AUDIENCE = "authenticated";
  env.NODE_ENV = "test";
  return env;
}

async function signJwt(payload) {
  const { signTestJwt } = await import("./auth.ts");
  return signTestJwt("test-secret", {
    sub: "user-1",
    role: "authenticated",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    app_metadata: { school_id: "school-1", role: "teacher" },
    ...payload,
  });
}

async function postUpload(env, formData, headers = {}) {
  return worker.fetch(
    new Request("https://gateway.example.test/api/upload", {
      method: "POST",
      headers: {
        Origin: "https://school.example.test",
        Authorization: "Bearer valid-token",
        ...headers,
      },
      body: formData,
    }),
    env
  );
}

test("preflight only allows configured origins", async () => {
  const env = createEnv(async () => new Response("unused"));

  const allowed = await worker.fetch(
    new Request("https://gateway.example.test/api/upload", {
      method: "OPTIONS",
      headers: { Origin: "https://school.example.test" },
    }),
    env
  );
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://school.example.test");

  const denied = await worker.fetch(
    new Request("https://gateway.example.test/api/upload", {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.test" },
    }),
    env
  );
  assert.equal(denied.headers.has("Access-Control-Allow-Origin"), false);
});

test("upload rejects missing bearer token", async () => {
  const env = createEnv(async () => new Response("unused"));
  const formData = new FormData();
  formData.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
  formData.set("entityType", "document");

  const res = await postUpload(env, formData, { Authorization: "" });

  assert.equal(res.status, 401);
});

test("upload rejects upstream authorization failure", async () => {
  const env = createEnv(async () => new Response("Forbidden", { status: 403 }));
  const formData = new FormData();
  formData.set("file", new File(["hello"], "note.pdf", { type: "application/pdf" }));
  formData.set("entityType", "document");

  const res = await postUpload(env, formData);

  assert.equal(res.status, 403);
  assert.equal(env.__uploads.objects.size, 0);
});

test("upload ignores client path and stores with upstream-authorized key", async () => {
  const env = createEnv(async (req) => {
    assert.equal(req.url, "https://app.example.test/api/files/authorize-upload");
    assert.equal(req.headers.get("Authorization"), "Bearer valid-token");
    const body = await req.json();
    assert.equal(body.filename, "note.pdf");
    assert.equal(body.entityType, "document");
    assert.equal(body.size, 5);
    return Response.json({
      bucket: "uploads",
      key: "school-1/document/user-1/authorized-note.pdf",
      url: "https://cdn.example.test/school-1/document/user-1/authorized-note.pdf",
    });
  });

  const formData = new FormData();
  formData.set("file", new File(["hello"], "note.pdf", { type: "application/pdf" }));
  formData.set("entityType", "document");
  formData.set("path", "../../attacker-controlled.pdf");

  const res = await postUpload(env, formData);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.key, "school-1/document/user-1/authorized-note.pdf");
  assert.equal(env.__uploads.objects.has("school-1/document/user-1/authorized-note.pdf"), true);
  assert.equal(env.__uploads.objects.has("../../attacker-controlled.pdf"), false);
});

test("download rejects cross-school upload keys", async () => {
  const env = createSessionEnv(async () => new Response("unused"));
  env.__uploads.objects.set("school-2/document/user-2/private.pdf", {
    value: new Uint8Array([1, 2, 3]),
    options: { httpMetadata: { contentType: "application/pdf" } },
  });
  const token = await signJwt({});

  const res = await worker.fetch(
    new Request("https://gateway.example.test/api/files/school-2/document/user-2/private.pdf", {
      headers: {
        Origin: "https://school.example.test",
        Authorization: `Bearer ${token}`,
      },
    }),
    env,
  );

  assert.equal(res.status, 403);
});

test("download serves same-school upload with private no-store headers", async () => {
  const env = createSessionEnv(async () => new Response("unused"));
  env.__uploads.objects.set("school-1/document/user-1/private.pdf", {
    value: new Uint8Array([1, 2, 3]),
    options: { httpMetadata: { contentType: "application/pdf" } },
  });
  const token = await signJwt({});

  const res = await worker.fetch(
    new Request("https://gateway.example.test/api/files/school-1/document/user-1/private.pdf", {
      headers: {
        Origin: "https://school.example.test",
        Authorization: `Bearer ${token}`,
      },
    }),
    env,
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  assert.equal(
    res.headers.get("Cache-Control"),
    "private, no-store, max-age=0, must-revalidate",
  );
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
});

test("download rejects traversal, backslash, empty, and control-character keys", async () => {
  const env = createSessionEnv(async () => new Response("unused"));
  const token = await signJwt({});
  const authHeaders = {
    Origin: "https://school.example.test",
    Authorization: `Bearer ${token}`,
  };

  // Paths that survive URL parsing, then fail normalizeUploadKey after decode.
  const paths = [
    "/api/files/school-1/%2e%2e%2fschool-2/secret.pdf", // ".."
    "/api/files/school-1/foo%5cbar.pdf", // backslash
    "/api/files/", // empty
    "/api/files/school-1/document/evil%00.pdf", // NUL
    "/api/files/school-1/document/evil%7f.pdf", // DEL
  ];

  for (const path of paths) {
    const res = await worker.fetch(
      new Request(`https://gateway.example.test${path}`, { headers: authHeaders }),
      env,
    );
    assert.equal(res.status, 400, `expected 400 for path ${path}`);
  }
});

test("cached proxy does not leak bearer token into upstream URL", async () => {
  const token = await signJwt({});
  const env = createSessionEnv(async (req) => {
    assert.equal(new URL(req.url).searchParams.has("__zamschool_auth"), false);
    assert.equal(req.headers.get("Authorization"), `Bearer ${token}`);
    return Response.json(
      { success: true, data: { school: "school-1" } },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  });
  globalThis.caches = {
    default: {
      async match() {
        return null;
      },
      async put(req) {
        const cacheUrl = new URL(req.url);
        const authDigest = cacheUrl.searchParams.get("__zamschool_auth") || "";
        assert.match(authDigest, /^[a-f0-9]{64}$/);
        assert.equal(req.headers.get("Authorization"), null);
        assert.doesNotMatch(req.url, /Bearer|eyJ|test-secret/);
      },
    },
  };

  const res = await worker.fetch(
    new Request("https://gateway.example.test/api/dashboard/summary?term=current", {
      headers: {
        Origin: "https://school.example.test",
        Authorization: `Bearer ${token}`,
      },
    }),
    env,
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("X-Edge-Cache-Decision"), "stored");
});

test("cached proxy isolates hits between two users on the same route", async () => {
  const tokenA = await signJwt({
    sub: "user-a",
    app_metadata: { school_id: "school-1", role: "teacher" },
  });
  const tokenB = await signJwt({
    sub: "user-b",
    app_metadata: { school_id: "school-1", role: "teacher" },
  });

  /** @type {Map<string, Response>} */
  const store = new Map();
  /** @type {string[]} */
  const upstreamAuths = [];

  const env = createSessionEnv(async (req) => {
    const auth = req.headers.get("Authorization") || "";
    upstreamAuths.push(auth);
    const user =
      auth === `Bearer ${tokenA}`
        ? "user-a"
        : auth === `Bearer ${tokenB}`
          ? "user-b"
          : "unknown";
    return Response.json(
      { success: true, data: { user } },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  });

  globalThis.caches = {
    default: {
      async match(req) {
        const key = typeof req === "string" ? req : req.url;
        const cached = store.get(key);
        return cached ? cached.clone() : null;
      },
      async put(req, res) {
        const key = typeof req === "string" ? req : req.url;
        const cacheUrl = new URL(key);
        assert.match(cacheUrl.searchParams.get("__zamschool_auth") || "", /^[a-f0-9]{64}$/);
        assert.doesNotMatch(key, /Bearer|eyJ/);
        store.set(key, res.clone());
      },
    },
  };

  const routeUrl = "https://gateway.example.test/api/dashboard/summary?term=current";
  const authHeaders = (token) => ({
    Origin: "https://school.example.test",
    Authorization: `Bearer ${token}`,
  });

  const firstA = await worker.fetch(
    new Request(routeUrl, { headers: authHeaders(tokenA) }),
    env,
  );
  assert.equal(firstA.status, 200);
  assert.equal(firstA.headers.get("X-Cache"), "MISS");
  assert.equal(firstA.headers.get("X-Edge-Cache-Decision"), "stored");
  assert.deepEqual(await firstA.json(), { success: true, data: { user: "user-a" } });

  const secondA = await worker.fetch(
    new Request(routeUrl, { headers: authHeaders(tokenA) }),
    env,
  );
  assert.equal(secondA.status, 200);
  assert.equal(secondA.headers.get("X-Cache"), "HIT");
  assert.equal(secondA.headers.get("X-Served-From"), "edge-cache");
  assert.deepEqual(await secondA.json(), { success: true, data: { user: "user-a" } });

  const firstB = await worker.fetch(
    new Request(routeUrl, { headers: authHeaders(tokenB) }),
    env,
  );
  assert.equal(firstB.status, 200);
  assert.equal(firstB.headers.get("X-Cache"), "MISS");
  assert.equal(firstB.headers.get("X-Edge-Cache-Decision"), "stored");
  assert.deepEqual(await firstB.json(), { success: true, data: { user: "user-b" } });

  // Same path, two auth digests → two cache slots; user B never sees user A.
  assert.equal(store.size, 2);
  assert.equal(upstreamAuths.filter((h) => h === `Bearer ${tokenA}`).length, 1);
  assert.equal(upstreamAuths.filter((h) => h === `Bearer ${tokenB}`).length, 1);
});
