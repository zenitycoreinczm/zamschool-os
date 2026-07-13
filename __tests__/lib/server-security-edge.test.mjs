import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isAllowedEdgeHost,
  isDisallowedEdgeMethod,
  isEdgeContentLengthAllowed,
  isOnStaticIpBlocklist,
} from "../../lib/server-security-edge.ts";

describe("server-security-edge", () => {
  it("rejects TRACE and TRACK", () => {
    assert.equal(isDisallowedEdgeMethod("TRACE"), true);
    assert.equal(isDisallowedEdgeMethod("TRACK"), true);
    assert.equal(isDisallowedEdgeMethod("POST"), false);
  });

  it("enforces content-length ceilings", () => {
    assert.equal(isEdgeContentLengthAllowed("100", "/api/auth/login-guard"), true);
    assert.equal(
      isEdgeContentLengthAllowed(String(2 * 1024 * 1024), "/api/auth/login-guard"),
      false,
    );
    assert.equal(
      isEdgeContentLengthAllowed(String(2 * 1024 * 1024), "/api/files/authorize-upload"),
      true,
    );
  });

  it("allows loopback hosts in development", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    try {
      assert.equal(isAllowedEdgeHost("localhost:3000"), true);
      assert.equal(isAllowedEdgeHost("127.0.0.1:3000"), true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("honours SECURITY_BLOCKED_IPS", () => {
    const prev = process.env.SECURITY_BLOCKED_IPS;
    process.env.SECURITY_BLOCKED_IPS = "203.0.113.10,198.51.100.2";
    try {
      assert.equal(isOnStaticIpBlocklist("203.0.113.10"), true);
      assert.equal(isOnStaticIpBlocklist("8.8.8.8"), false);
    } finally {
      if (prev === undefined) delete process.env.SECURITY_BLOCKED_IPS;
      else process.env.SECURITY_BLOCKED_IPS = prev;
    }
  });
});
