import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applyAuthApiRateLimit,
  authApiRateLimitResponse,
} from "@/lib/auth-api-rate-limit";
import {
  clearLoginFailures,
  getLoginLockoutStatus,
  recordLoginFailure,
} from "@/lib/redis/login-lockout";
import { isRedisConfigured } from "@/lib/redis/client";
import {
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
  validateRequestSecurity,
} from "@/lib/server-guards";

const bodySchema = z.object({
  email: z.string().email().max(320),
  outcome: z.enum(["check", "failure", "success"]),
  /** Honeypot — must always be empty. Bots that fill it are rejected. */
  website: z.string().max(200).optional(),
});

/**
 * Server-side login lockout backed by Upstash Redis.
 * Client localStorage cooldowns alone are bypassable — this is the real gate.
 */
export async function POST(req: Request) {
  try {
    const security = validateRequestSecurity(req);
    if (!security.valid) {
      return NextResponse.json(
        { error: security.error || "Request blocked" },
        { status: 403 },
      );
    }

    const rate = await applyAuthApiRateLimit({
      scope: "loginGuard",
      req,
    });
    if (!rate.allowed) return authApiRateLimitResponse(rate);

    const body = await parseJsonWithSchema(req, bodySchema);

    // Honeypot filled → silent reject (do not reveal detection).
    if (String(body.website || "").trim().length > 0) {
      return NextResponse.json({
        ok: true,
        redis: isRedisConfigured(),
        locked: true,
        retryAfterSec: 900,
        reason: "email",
      });
    }

    const email = body.email.trim().toLowerCase();
    const ip = getClientIp(req);

    const redis = isRedisConfigured();
    if (!redis && process.env.NODE_ENV === "production") {
      console.warn(
        "[login-guard] UPSTASH Redis is not configured in production — using process-local lockout only.",
      );
    }

    if (body.outcome === "check") {
      const status = await getLoginLockoutStatus({ email, ip });
      return NextResponse.json({
        ok: true,
        redis,
        backend: status.backend ?? (redis ? "redis" : "memory"),
        locked: status.locked,
        retryAfterSec: status.retryAfterSec,
        reason: status.reason ?? null,
      });
    }

    if (body.outcome === "failure") {
      const status = await recordLoginFailure({ email, ip });
      return NextResponse.json({
        ok: true,
        redis,
        backend: status.backend ?? (redis ? "redis" : "memory"),
        locked: status.locked,
        retryAfterSec: status.retryAfterSec,
        reason: status.reason ?? null,
      });
    }

    // success — clear email-scoped failures
    await clearLoginFailures({ email, ip });
    return NextResponse.json({
      ok: true,
      redis,
      backend: redis ? "redis" : "memory",
      locked: false,
      retryAfterSec: 0,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Login guard failed") },
      { status: 400 },
    );
  }
}
