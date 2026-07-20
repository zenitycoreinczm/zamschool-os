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
    assert.equal(isBlockedAttackPath("/.ssh/id_rsa"), true);
    assert.equal(isBlockedAttackPath("/actuator/health"), true);
    assert.equal(isBlockedAttackPath("/backup.sql"), true);
    assert.equal(isBlockedAttackPath("/phpinfo.php"), true);
  });

  it("allows normal app paths", () => {
    assert.equal(isBlockedAttackPath("/login"), false);
    assert.equal(isBlockedAttackPath("/app/registrar"), false);
    assert.equal(isBlockedAttackPath("/api/auth/login-guard"), false);
    assert.equal(isBlockedAttackPath("/"), false);
    assert.equal(isBlockedAttackPath("/.well-known/security.txt"), false);
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

  it("blocks sqlmap site-wide including product pages", () => {
    const result = classifyClientBot({
      userAgent: "sqlmap/1.7",
      pathname: "/app/admin/timetable",
    });
    assert.equal(result.block, true);
  });

  it("blocks curl/python scrapers on public pages in production", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        classifyClientBot({
          userAgent: "curl/8.0.0",
          pathname: "/",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "python-requests/2.31.0",
          pathname: "/api/admin/timetable",
        }).block,
        true,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("blocks AI training scrapers everywhere", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0)",
          pathname: "/",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "ClaudeBot/1.0",
          pathname: "/privacy",
        }).block,
        true,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("allows Googlebot only on public marketing paths", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
          pathname: "/",
        }).block,
        false,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
          pathname: "/login",
        }).block,
        false,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
          pathname: "/app/principal",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)",
          pathname: "/api/admin/users",
        }).block,
        true,
      );
      // Search Console URL inspection
      assert.equal(
        classifyClientBot({
          userAgent:
            "Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)",
          pathname: "/privacy",
        }).block,
        false,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("blocks non-Google crawlers even on public marketing paths", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; bingbot/2.0)",
          pathname: "/",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "DuckDuckBot/1.0",
          pathname: "/privacy",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; YandexBot/3.0)",
          pathname: "/",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
          pathname: "/",
        }).block,
        true,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
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

  it("allows official ZamSchool mobile app user agents on private APIs", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const result = classifyClientBot({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 ZamSchoolOS-Mobile/1.0",
        pathname: "/api/teacher/classes",
      });
      assert.equal(result.block, false);
      assert.equal(result.suspicious, false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("allows React Native Android okhttp only when Bearer auth is present", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      assert.equal(
        classifyClientBot({
          userAgent: "okhttp/4.9.2",
          pathname: "/api/teacher/results",
        }).block,
        true,
      );
      assert.equal(
        classifyClientBot({
          userAgent: "okhttp/4.9.2",
          pathname: "/api/teacher/results",
          authorization: "Bearer eyJhbGciOi.test",
        }).block,
        false,
      );
    } finally {
      process.env.NODE_ENV = prev;
    }
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
