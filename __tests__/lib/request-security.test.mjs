import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyClientBot,
  isBlockedAttackPath,
  isSafeInternalPath,
  isSensitiveAuthSurface,
  checkMiddlewareFloodLimit,
} from "../../lib/request-security.ts";

describe("isBlockedAttackPath", () => {
  it("blocks common scanner paths", () => {
    assert.equal(isBlockedAttackPath("/.env"), true);
    assert.equal(isBlockedAttackPath("/wp-admin/"), true);
    assert.equal(isBlockedAttackPath("/phpmyadmin"), true);
    assert.equal(isBlockedAttackPath("/.git/config"), true);
    assert.equal(isBlockedAttackPath("/xmlrpc.php"), true);
  });

  it("allows normal app paths", () => {
    assert.equal(isBlockedAttackPath("/login"), false);
    assert.equal(isBlockedAttackPath("/app/registrar"), false);
    assert.equal(isBlockedAttackPath("/api/auth/login-guard"), false);
    assert.equal(isBlockedAttackPath("/"), false);
  });
});

describe("isSafeInternalPath", () => {
  it("allows relative app paths", () => {
    assert.equal(isSafeInternalPath("/app/student"), true);
    assert.equal(isSafeInternalPath("/app/admin/users?tab=1"), true);
  });

  it("blocks open redirects", () => {
    assert.equal(isSafeInternalPath("//evil.com"), false);
    assert.equal(isSafeInternalPath("https://evil.com"), false);
    assert.equal(isSafeInternalPath("/\\evil.com"), false);
    assert.equal(isSafeInternalPath("javascript:alert(1)"), false);
    assert.equal(isSafeInternalPath(null), false);
    assert.equal(isSafeInternalPath(""), false);
  });
});

describe("classifyClientBot", () => {
  it("allows normal browser user agents on login", () => {
    const result = classifyClientBot({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      pathname: "/login",
    });
    assert.equal(result.block, false);
    assert.equal(result.suspicious, false);
  });

  it("blocks sqlmap on auth surfaces", () => {
    const result = classifyClientBot({
      userAgent: "sqlmap/1.7",
      pathname: "/api/auth/login-guard",
    });
    assert.equal(result.block, true);
  });

  it("blocks empty user agent on login in production-like scoring", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const result = classifyClientBot({
        userAgent: "",
        pathname: "/login",
      });
      assert.equal(result.block, true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("does not hard-block health probes", () => {
    const result = classifyClientBot({
      userAgent: "",
      pathname: "/api/health",
    });
    assert.equal(result.block, false);
  });
});

describe("isSensitiveAuthSurface", () => {
  it("marks auth and login paths", () => {
    assert.equal(isSensitiveAuthSurface("/login"), true);
    assert.equal(isSensitiveAuthSurface("/api/auth/send-otp"), true);
    assert.equal(isSensitiveAuthSurface("/app/registrar"), false);
  });
});

describe("checkMiddlewareFloodLimit", () => {
  it("allows under the limit and blocks after", () => {
    const key = `test-flood-${Date.now()}-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      const r = checkMiddlewareFloodLimit({ key, limit: 3, windowMs: 60_000 });
      assert.equal(r.allowed, true);
    }
    const blocked = checkMiddlewareFloodLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSec >= 1);
  });
});
