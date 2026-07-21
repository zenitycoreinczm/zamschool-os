import { NextResponse } from "next/server";
import { applyRateLimit, getClientIp } from "./server-guards";

import { isFreeTierMode } from "./free-tier-guard";

const free = isFreeTierMode();

/** Fail-closed limits for unauthenticated or credential-sensitive auth API routes. */
export const AUTH_API_RATE_LIMITS = {
  verifyAccessCode: { limit: free ? 5 : 8, windowMs: 60_000 },
  sendOtp: { limit: free ? 3 : 5, windowMs: 60_000 },
  verifyOtp: { limit: free ? 6 : 10, windowMs: 60_000 },
  registerSchool: { limit: free ? 3 : 5, windowMs: 60_000 },
  acceptInvitation: { limit: free ? 5 : 8, windowMs: 60_000 },
  completeFirstLogin: { limit: free ? 10 : 15, windowMs: 60_000 },
  forgotPassword: { limit: free ? 2 : 3, windowMs: 60_000 },
  resetPassword: { limit: free ? 3 : 5, windowMs: 60_000 },
  mfaEnroll: { limit: free ? 5 : 8, windowMs: 60_000 },
  mfaChallenge: { limit: free ? 12 : 20, windowMs: 60_000 },
  mfaVerify: { limit: free ? 5 : 6, windowMs: 60_000 },
  mfaFactorsRead: { limit: free ? 20 : 30, windowMs: 60_000 },
  mfaFactorsDelete: { limit: free ? 5 : 8, windowMs: 60_000 },
  /** Login lockout check / record (server-side Redis).
   *  3 attempts × 2 calls each (check + failure) = 6 minimum; allow 10 for
   *  retries / success calls before the outer guard fires. */
  loginGuard: { limit: free ? 6 : 10, windowMs: 60_000 },
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