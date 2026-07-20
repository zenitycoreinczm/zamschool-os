import { NextResponse } from "next/server";

import { consumeDailyUsage, type DailyUsageResult } from "./daily-usage-limit";
import { freeTierPlatformRatePresets } from "./free-tier-guard";
import { applyRateLimit } from "./server-guards";
import { tenantActorRateLimitKey } from "@/lib/tenant/tenant-context";

const IS_DEV = process.env.NODE_ENV === "development";

const freePlatform = freeTierPlatformRatePresets();

export const PLATFORM_RATE_PRESETS = {
  messagesRead: freePlatform.messagesRead!,
  messagesWrite: freePlatform.messagesWrite!,
  unreadSummary: freePlatform.unreadSummary!,
  workspaceContext: freePlatform.workspaceContext!,
  teacherBootstrap: freePlatform.teacherBootstrap!,
  teacherDashboard: freePlatform.teacherDashboard!,
  teacherClasses: freePlatform.teacherClasses!,
  teacherStudents: freePlatform.teacherStudents!,
  teacherSubjects: freePlatform.teacherSubjects!,
  teacherResultsCompleteness: freePlatform.teacherResultsCompleteness!,
  teacherAttendanceWrite: freePlatform.teacherAttendanceWrite!,
  accountContacts: freePlatform.accountContacts!,
  heavyRead: freePlatform.heavyRead!,
  uploadAuthorize: freePlatform.uploadAuthorize!,
  uploadValidate: freePlatform.uploadValidate!,
} as const;

const LOCAL_BYPASS_PRESETS = new Set<keyof typeof PLATFORM_RATE_PRESETS>([
  "messagesRead",
  "unreadSummary",
  "workspaceContext",
  "teacherBootstrap",
  "teacherDashboard",
  "teacherClasses",
  "teacherStudents",
  "teacherSubjects",
  "teacherResultsCompleteness",
  "accountContacts",
  "heavyRead",
]);

export async function applyPlatformRateLimit(params: {
  scope: string;
  schoolId: string | null;
  req: Request;
  userId?: string | null;
  preset: keyof typeof PLATFORM_RATE_PRESETS;
}) {
  const { limit, windowMs } = PLATFORM_RATE_PRESETS[params.preset];
  return applyRateLimit({
    key: tenantActorRateLimitKey({
      scope: params.scope,
      schoolId: params.schoolId,
      req: params.req,
      userId: params.userId,
    }),
    limit,
    windowMs,
    failOpen: IS_DEV,
    localBypass: LOCAL_BYPASS_PRESETS.has(params.preset)
      ? { ttlMs: 2_000, maxRequests: 3 }
      : undefined,
  });
}

export function platformRateLimitResponse(rate: {
  allowed: false;
  retryAfterSec: number;
}) {
  return NextResponse.json(
    {
      error: "Too many requests. Please try again shortly.",
      code: "RATE_LIMIT_EXCEEDED",
    },
    {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSec) },
    },
  );
}

export function dailyLimitExceededResponse(
  usage: DailyUsageResult,
  message?: string,
) {
  return NextResponse.json(
    {
      error:
        message ||
        `Daily limit reached (${usage.limit} per day). You have used ${usage.current}. Try again tomorrow.`,
      code: "DAILY_LIMIT_EXCEEDED",
      limit: usage.limit,
      current: usage.current,
      remaining: usage.remaining,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(usage.retryAfterSec),
        "X-Daily-Limit": String(usage.limit),
        "X-Daily-Remaining": String(usage.remaining),
      },
    },
  );
}

export async function enforceDailyMessageSendLimit(userId: string) {
  const usage = await consumeDailyUsage(userId, "messages_send");
  if (!usage.allowed) {
    return dailyLimitExceededResponse(
      usage,
      `You can send up to ${usage.limit} messages per day on the free plan. Try again tomorrow.`,
    );
  }
  return null;
}
