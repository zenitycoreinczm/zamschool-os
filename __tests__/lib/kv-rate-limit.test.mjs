import test from "node:test";
import assert from "node:assert/strict";

// The Next.js rate limiter calls checkKvRateLimit(identifier, scope) where
// scope is the route keyPrefix ("default" for most routes) — NOT one of the
// KV LIMITS categories (api/auth/...). Unknown categories must fall back to
// the api ceilings; allow-all would silently disable KV enforcement whenever
// Redis is down.

process.env.KV_REST_API_URL =
  "https://api.cloudflare.com/client/v4/accounts/acc123/storage/kv/namespaces/ns123";
process.env.KV_REST_API_TOKEN = "test-token";
// Pin free-tier ceilings (api 60/min, auth 8/min) so assertions are env-independent.
process.env.ZAMSCHOOL_FREE_TIER = "true";

const kv = await import("../../lib/kv-client.ts");

function mockFetchReturning(countText) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method || "GET" });
    return new Response(countText, { status: 200 });
  };
  return calls;
}

test("unknown rate-limit category falls back to api ceilings (not allow-all)", async () => {
  const originalFetch = globalThis.fetch;
  try {
    // Counter already at the api ceiling (60): an unknown scope must deny.
    mockFetchReturning("60");
    const over = await kv.checkKvRateLimit("user-1", "default");
    assert.equal(over.allowed, false);
    assert.equal(over.remaining, 0);

    // Below the ceiling: allowed with decremented remaining.
    mockFetchReturning("10");
    const under = await kv.checkKvRateLimit("user-1", "default");
    assert.equal(under.allowed, true);
    assert.equal(under.remaining, 60 - 10 - 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("known categories keep their own ceilings", async () => {
  const originalFetch = globalThis.fetch;
  try {
    mockFetchReturning("7");
    const auth = await kv.checkKvRateLimit("user-1", "auth");
    assert.equal(auth.allowed, true);
    assert.equal(auth.remaining, 8 - 7 - 1);

    mockFetchReturning("8");
    const authCapped = await kv.checkKvRateLimit("user-1", "auth");
    assert.equal(authCapped.allowed, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
