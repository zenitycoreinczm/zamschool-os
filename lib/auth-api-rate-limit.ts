import { NextResponse } from "next/server";
import { applyRateLimit, getClientIp } from "./server-guards";

/** Fail-closed limits for unauthenticated or credential-sensitive auth API routes. */
export const AUTH_API_RATE_LIMITS = {
  verifyAccessCode: { limit: 8, windowMs: 60_000 },
  sendOtp: { limit: 5, windowMs: 60_000 },
  verifyOtp: { limit: 10, windowMs: 60_000 },
  registerSchool: { limit: 5, windowMs: 60_000 },
  acceptInvitation: { limit: 8, windowMs: 60_000 },
  completeFirstLogin: { limit: 15, windowMs: 60_000 },
  forgotPassword: { limit: 3, windowMs: 60_000 },
  resetPassword: { limit: 5, windowMs: 60_000 },
  mfaEnroll: { limit: 8, windowMs: 60_000 },
  mfaChallenge: { limit: 20, windowMs: 60_000 },
  mfaVerify: { limit: 6, windowMs: 60_000 },
  mfaFactorsRead: { limit: 30, windowMs: 60_000 },
  mfaFactorsDelete: { limit: 8, windowMs: 60_000 },
  /** Login lockout check / record (server-side Redis). */
  loginGuard: { limit: 20, windowMs: 60_000 },
} as const;

export type AuthApiRateLimitScope = keyof typeof AUTH_API_RATE_LIMITS;

export async function applyAuthApiRateLimit(params: {
  scope: AuthApiRateLimitScope;
  req: Request;
  userId?: string | null;
  limit?: number;
  windowMs?: number;
}) {
  const preset = AUTH_API_RATE_LIMITS[params.scope];
  const ip = getClientIp(params.req);
  const userSuffix = params.userId ? `:${params.userId}` : "";

  return applyRateLimit({
    key: `auth-api:${params.scope}:${ip}${userSuffix}`,
    limit: params.limit ?? preset.limit,
    windowMs: params.windowMs ?? preset.windowMs,
    failOpen: false,
  });
}

export function authApiRateLimitResponse(rate: { allowed: false; retryAfterSec: number }) {
  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    }
  );
}