import test from "node:test";
import assert from "node:assert/strict";

// ─── stateless-token behavioral tests ──────────────────────────────────────
//
// These tests exercise the actual create/verify round-trip of the HMAC
// password-reset token, including the fail-closed secret guard and
// tamper/expiry rejection.
//
// SECURITY (H-01): RESET_TOKEN_SECRET is the ONLY accepted secret. Service
// role keys and SMTP credentials must never be used as an HMAC fallback.

const TOKEN_MODULE_PATH = "../../lib/stateless-token.ts";

const LONG_SECRET = "0123456789abcdef0123456789abcdef";

async function loadTokenModule() {
  return import(TOKEN_MODULE_PATH);
}

function withEnv(env, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test("createResetToken throws when no HMAC secret is configured", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SMTP_PASS: undefined,
      RESET_TOKEN_SECRET: undefined,
    },
    async () => {
      const { createResetToken } = await loadTokenModule();
      assert.throws(
        () => createResetToken("user-123"),
        /Security Error.*RESET_TOKEN_SECRET/is,
      );
    },
  );
});

test("createResetToken never falls back to service-role or SMTP secrets (H-01)", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: "a".repeat(48),
      SMTP_PASS: "b".repeat(48),
      RESET_TOKEN_SECRET: undefined,
    },
    async () => {
      const { createResetToken } = await loadTokenModule();
      // Old behavior derived the HMAC from these shared secrets - that let
      // any leak of one secret enable reset-token forgery. Must throw now.
      assert.throws(
        () => createResetToken("user-123"),
        /Security Error.*RESET_TOKEN_SECRET/is,
      );
    },
  );
});

test("createResetToken rejects a too-short secret", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SMTP_PASS: undefined,
      RESET_TOKEN_SECRET: "short-secret",
    },
    async () => {
      const { createResetToken } = await loadTokenModule();
      assert.throws(
        () => createResetToken("user-123"),
        /RESET_TOKEN_SECRET is missing or too short/is,
      );
    },
  );
});

test("createResetToken succeeds with RESET_TOKEN_SECRET", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SMTP_PASS: undefined,
      RESET_TOKEN_SECRET: LONG_SECRET,
    },
    async () => {
      const { createResetToken } = await loadTokenModule();
      const token = createResetToken("user-123");
      assert.ok(typeof token === "string" && token.length > 0);
    },
  );
});

test("verifyResetToken round-trips a valid token", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SMTP_PASS: undefined,
      RESET_TOKEN_SECRET: "round-trip-secret-0123456789abcdef",
    },
    async () => {
      const { createResetToken, verifyResetToken } = await loadTokenModule();
      const token = createResetToken("user-abc");
      const payload = verifyResetToken(token);
      assert.ok(payload);
      assert.equal(payload.userId, "user-abc");
    },
  );
});

test("verifyResetToken rejects a tampered token", async () => {
  await withEnv(
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "tamper-secret-0123456789abcdef00" },
    async () => {
      const { createResetToken, verifyResetToken } = await loadTokenModule();
      const token = createResetToken("user-xyz");
      // Flip a character in the middle of the base64url string
      const tampered =
        token.slice(0, token.length - 2) +
        (token[token.length - 2] === "A" ? "B" : "A") +
        (token[token.length - 1] === "A" ? "B" : "A");
      assert.equal(verifyResetToken(tampered), null);
    },
  );
});

test("verifyResetToken rejects a malformed token", async () => {
  await withEnv(
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "malformed-secret-0123456789ab" },
    async () => {
      const { verifyResetToken } = await loadTokenModule();
      assert.equal(verifyResetToken("not-a-valid-token"), null);
      assert.equal(verifyResetToken(""), null);
      assert.equal(verifyResetToken("a:b:c"), null);
    },
  );
});

test("verifyResetToken rejects a token signed with a different secret", async () => {
  // Mint with one secret, verify with another - HMAC mismatch must fail.
  let token;
  await withEnv(
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "secret-A-0123456789abcdef0123456" },
    async () => {
      const { createResetToken } = await loadTokenModule();
      token = createResetToken("user-cross");
    },
  );
  await withEnv(
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "secret-B-0123456789abcdef0123456" },
    async () => {
      const { verifyResetToken } = await loadTokenModule();
      assert.equal(verifyResetToken(token), null);
    },
  );
});
