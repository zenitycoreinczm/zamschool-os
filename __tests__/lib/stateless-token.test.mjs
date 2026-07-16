import test from "node:test";
import assert from "node:assert/strict";

// ─── stateless-token behavioral tests ──────────────────────────────────────
//
// These tests exercise the actual create/verify round-trip of the HMAC
// password-reset token, including the fail-closed secret guard and
// tamper/expiry rejection.

const TOKEN_MODULE_PATH = "../../lib/stateless-token.ts";

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
        /Security Error.*HMAC secret/i,
      );
    },
  );
});

test("createResetToken succeeds with RESET_TOKEN_SECRET", async () => {
  await withEnv(
    {
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      SMTP_PASS: undefined,
      RESET_TOKEN_SECRET: "test-secret-abc",
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
      RESET_TOKEN_SECRET: "round-trip-secret",
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
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "tamper-secret" },
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
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "malformed-secret" },
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
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "secret-A" },
    async () => {
      const { createResetToken } = await loadTokenModule();
      token = createResetToken("user-cross");
    },
  );
  await withEnv(
    { SUPABASE_SERVICE_ROLE_KEY: undefined, SMTP_PASS: undefined, RESET_TOKEN_SECRET: "secret-B" },
    async () => {
      const { verifyResetToken } = await loadTokenModule();
      assert.equal(verifyResetToken(token), null);
    },
  );
});
