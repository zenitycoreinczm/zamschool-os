import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  isFreeTierMode,
  freeTierFloodLimits,
  freeTierDistributedEdgeLimits,
  freeTierPublicRateLimits,
  freeTierPlatformRatePresets,
  freeTierIpAbusePolicy,
  isProductionInvocationBlockedPath,
} from "../../lib/free-tier-guard.ts";

const ENV_KEYS = [
  "ZAMSCHOOL_FREE_TIER",
  "VERCEL_ENV",
  "NODE_ENV",
  "VERCEL",
];

describe("free-tier-guard", () => {
  /** @type {Record<string, string | undefined>} */
  let saved = {};

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("isFreeTierMode respects explicit false", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    process.env.NODE_ENV = "production";
    assert.equal(isFreeTierMode(), false);
  });

  it("isFreeTierMode respects explicit true", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    process.env.NODE_ENV = "development";
    assert.equal(isFreeTierMode(), true);
  });

  it("free tier flood limits are tighter than paid", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const free = freeTierFloodLimits();
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    const paid = freeTierFloodLimits();

    assert.ok(free.api.normal < paid.api.normal);
    assert.ok(free.auth.normal < paid.auth.normal);
    assert.ok(free.page.normal < paid.page.normal);
    assert.ok(free.api.suspicious < free.api.normal);
  });

  it("distributed edge limits include daily API cap on free tier", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const free = freeTierDistributedEdgeLimits();
    assert.ok(free.apiDaily.maxRequests <= 3_000);
    assert.ok(free.api.maxRequests <= 80);
    assert.ok(free.localBypass.maxRequests >= 1);
  });

  it("public rate limits are stricter on free tier", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const free = freeTierPublicRateLimits();
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    const paid = freeTierPublicRateLimits();
    assert.ok(free.default.maxRequests <= paid.default.maxRequests);
    assert.ok(free.signup.maxRequests <= paid.signup.maxRequests);
  });

  it("platform presets lower teacher fan-out on free tier", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const free = freeTierPlatformRatePresets();
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    const paid = freeTierPlatformRatePresets();
    assert.ok(free.teacherClasses.limit < paid.teacherClasses.limit);
    assert.ok(free.messagesWrite.limit <= paid.messagesWrite.limit);
  });

  it("ip abuse bans sooner on free tier", () => {
    process.env.ZAMSCHOOL_FREE_TIER = "true";
    const free = freeTierIpAbusePolicy();
    process.env.ZAMSCHOOL_FREE_TIER = "false";
    const paid = freeTierIpAbusePolicy();
    assert.ok(free.banThreshold < paid.banThreshold);
    assert.ok(free.banTtlSec >= paid.banTtlSec);
  });

  it("blocks production invocation of debug and load-test paths", () => {
    assert.equal(isProductionInvocationBlockedPath("/api/debug/env"), true);
    assert.equal(isProductionInvocationBlockedPath("/api/test-email"), true);
    assert.equal(isProductionInvocationBlockedPath("/api/load-test/ping"), true);
    assert.equal(isProductionInvocationBlockedPath("/api/__/internal"), true);
    assert.equal(isProductionInvocationBlockedPath("/api/health"), false);
    assert.equal(isProductionInvocationBlockedPath("/api/teacher/dashboard"), false);
  });
});
