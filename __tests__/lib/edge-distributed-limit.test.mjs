import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  checkEdgeDistributedLimit,
  resetEdgeDistributedBypassForTests,
} from "../../lib/edge-distributed-limit.ts";

describe("edge-distributed-limit", () => {
  /** @type {string | undefined} */
  let savedFreeTier;

  beforeEach(() => {
    savedFreeTier = process.env.ZAMSCHOOL_FREE_TIER;
    resetEdgeDistributedBypassForTests();
  });

  afterEach(() => {
    if (savedFreeTier === undefined) delete process.env.ZAMSCHOOL_FREE_TIER;
    else process.env.ZAMSCHOOL_FREE_TIER = savedFreeTier;
    resetEdgeDistributedBypassForTests();
  });

  it("allows when free-tier mode is off (no Redis burn)", async () => {
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    const result = await checkEdgeDistributedLimit({
      ip: "203.0.113.10",
      surface: "api",
    });
    assert.equal(result.allowed, true);
  });

  it("allows unknown IP without Redis collision", async () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const result = await checkEdgeDistributedLimit({
      ip: "unknown",
      surface: "api",
    });
    assert.equal(result.allowed, true);
  });

  it("fails open when free tier on but Redis unset", async () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    // Without Upstash env, isRedisConfigured() is false → allow
    const prevUrl = process.env.UPSTASH_REDIS_REST_URL;
    const prevToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    try {
      const result = await checkEdgeDistributedLimit({
        ip: "203.0.113.11",
        surface: "auth",
        suspicious: true,
      });
      assert.equal(result.allowed, true);
    } finally {
      if (prevUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
      else process.env.UPSTASH_REDIS_REST_URL = prevUrl;
      if (prevToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
      else process.env.UPSTASH_REDIS_REST_TOKEN = prevToken;
    }
  });
});
