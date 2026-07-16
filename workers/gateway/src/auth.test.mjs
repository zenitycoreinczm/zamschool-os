import { importTsModule } from "../../../scripts/test-ts-module.mjs";

const { verifyAuth, signTestJwt, resetJwksCacheForTests } = await importTsModule(
  "./auth.ts",
  import.meta.url,
);

import test from "node:test";
import assert from "node:assert/strict";
const TEST_SECRET = "test-jwt-secret-for-unit-tests";

function createKv() {
  const store = new Map();
  return {
    store,
    async get(key, options) {
      const value = store.get(key);
      if (!value) return null;
      if (options?.type === "json") {
        return JSON.parse(value);
      }
      return value;
    },
    async put(key, value, _options) {
      store.set(key, typeof value === "string" ? value : JSON.stringify(value));
    },
  };
}

function createEnv(overrides = {}) {
  return {
    SESSION_CACHE: createKv(),
    SUPABASE_JWT_SECRET: TEST_SECRET,
    JWT_VERIFY_MODE: "signature",
    SUPABASE_JWT_AUDIENCE: "authenticated",
    ...overrides,
  };
}

test("verifyAuth accepts valid HS256 Supabase-style JWT", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signTestJwt(TEST_SECRET, {
    sub: "user-1",
    role: "authenticated",
    aud: "authenticated",
    email: "teacher@school.test",
    exp,
    user_metadata: { school_id: "school-1" },
  });

  const env = createEnv();
  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );

  assert.ok(session);
  assert.equal(session.userId, "user-1");
  assert.equal(session.schoolId, "school-1");
  assert.equal(session.role, "authenticated");
});

test("verifyAuth rejects tampered JWT signature", async () => {
  const token = await signTestJwt(TEST_SECRET, {
    sub: "user-1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  // Tamper the *payload*, not the signature, so the HMAC is guaranteed to fail.
  // Mutating only the last base64url char of the signature has a ~1/64 chance
  // of producing a valid HMAC for the original payload - that's a flaky test.
  const [headerPart, , signaturePart] = token.split(".");
  const tamperedPayload = btoa(
    JSON.stringify({
      sub: "user-1",
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      user_metadata: { school_id: "attacker-school" },
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const tampered = `${headerPart}.${tamperedPayload}.${signaturePart}`;

  const env = createEnv();
  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${tampered}` },
    }),
    env
  );

  assert.equal(session, null);
});

test("verifyAuth rejects expired JWT", async () => {
  const token = await signTestJwt(TEST_SECRET, {
    sub: "user-1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) - 60,
  });

  const env = createEnv();
  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );

  assert.equal(session, null);
});

test("verifyAuth rejects decode mode without ALLOW_INSECURE_JWT_DECODE", async () => {
  const token = await signTestJwt(TEST_SECRET, {
    sub: "user-1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });

  const env = createEnv({
    SUPABASE_JWT_SECRET: "",
    JWT_VERIFY_MODE: "decode",
    ALLOW_INSECURE_JWT_DECODE: "false",
  });

  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );

  assert.equal(session, null);
});

test("verifyAuth allows decode mode only with explicit insecure flag", async () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = await signTestJwt(TEST_SECRET, {
    sub: "user-2",
    aud: "authenticated",
    exp,
    user_metadata: { school_id: "school-2" },
  });

  const env = createEnv({
    SUPABASE_JWT_SECRET: "",
    JWT_VERIFY_MODE: "decode",
    ALLOW_INSECURE_JWT_DECODE: "true",
  });

  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );

  assert.ok(session);
  assert.equal(session.userId, "user-2");
});

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

test("verifyAuth accepts valid ES256 JWT via JWKS", async () => {
  resetJwksCacheForTests();

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  publicJwk.kid = "test-es256-kid";
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";

  const header = { alg: "ES256", typ: "JWT", kid: "test-es256-kid" };
  const payload = {
    sub: "es-user",
    role: "authenticated",
    aud: "authenticated",
    iss: "https://example.supabase.co/auth/v1",
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: "es@school.test",
    user_metadata: { school_id: "school-es" },
  };

  const encoder = new TextEncoder();
  const headerPart = bytesToBase64Url(encoder.encode(JSON.stringify(header)));
  const payloadPart = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const signedContent = `${headerPart}.${payloadPart}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keyPair.privateKey,
      encoder.encode(signedContent),
    ),
  );
  const token = `${signedContent}.${bytesToBase64Url(sig)}`;

  const env = createEnv({
    SUPABASE_JWT_SECRET: "",
    SUPABASE_JWT_ISSUER: "https://example.supabase.co/auth/v1",
    SUPABASE_JWKS_URL: "https://example.supabase.co/auth/v1/.well-known/jwks.json",
    fetch: async (url) => {
      assert.equal(String(url), "https://example.supabase.co/auth/v1/.well-known/jwks.json");
      return new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const session = await verifyAuth(
    new Request("https://gateway.test/api/student/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env,
  );

  assert.ok(session);
  assert.equal(session.userId, "es-user");
  assert.equal(session.schoolId, "school-es");
});
