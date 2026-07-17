import { importTsModule } from "../../../scripts/test-ts-module.mjs";

const {
  checkGatewayRateLimit,
  GATEWAY_RATE_LIMITS,
  resetRateLimitMemoryForTests,
} = await importTsModule("./rate-limit.ts", import.meta.url);

import test from "node:test";
import assert from "node:assert/strict";

test("rate limit allows requests under max via isolate memory", async () => {
  resetRateLimitMemoryForTests();
  const env = {
    RATE_LIMIT_ENABLED: "true",
    // No Upstash → memory path (0 KV)
  };

  const config = { ...GATEWAY_RATE_LIMITS.read, maxRequests: 3 };
  const first = await checkGatewayRateLimit(env, "school-1:user-1", config);
  const second = await checkGatewayRateLimit(env, "school-1:user-1", config);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 1);
});

test("rate limit blocks when max exceeded (memory)", async () => {
  resetRateLimitMemoryForTests();
  const env = { RATE_LIMIT_ENABLED: "true" };
  const config = { ...GATEWAY_RATE_LIMITS.upload, maxRequests: 2 };

  await checkGatewayRateLimit(env, "ip-1", config);
  await checkGatewayRateLimit(env, "ip-1", config);
  const blocked = await checkGatewayRateLimit(env, "ip-1", config);

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});

test("rate limit is no-op when RATE_LIMIT_ENABLED is not true", async () => {
  resetRateLimitMemoryForTests();
  const env = { RATE_LIMIT_ENABLED: "false" };
  const config = { ...GATEWAY_RATE_LIMITS.mutation, maxRequests: 1 };

  for (let i = 0; i < 5; i++) {
    const result = await checkGatewayRateLimit(env, "school-1:user-1", config);
    assert.equal(result.allowed, true);
  }
});

test("rate limit uses Upstash pipeline when credentials present", async () => {
  resetRateLimitMemoryForTests();
  let calls = 0;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.match(String(url), /\/pipeline$/);
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body || "[]"));
    assert.equal(body[0][0], "INCR");
    assert.equal(body[1][0], "EXPIRE");
    // Simulate first then second INCR
    const count = calls;
    return new Response(JSON.stringify([{ result: count }, { result: 1 }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const env = {
      RATE_LIMIT_ENABLED: "true",
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    };
    const config = { ...GATEWAY_RATE_LIMITS.read, maxRequests: 2 };

    const first = await checkGatewayRateLimit(env, "user-redis", config);
    const second = await checkGatewayRateLimit(env, "user-redis", config);
    const third = await checkGatewayRateLimit(env, "user-redis", config);

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
