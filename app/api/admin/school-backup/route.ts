import { NextResponse } from "next/server";

import { applyRateLimit, getClientIp, safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import {
  biweeklyPeriodId,
  biweeklyPeriodLabel,
  ensureSchoolBackupSnapshot,
  getSchoolBackupSnapshot,
} from "@/lib/school-backup-snapshot";
import { isRedisConfigured } from "@/lib/redis/client";
import { REDIS_TTL } from "@/lib/redis/ttl";

const ALLOWED = ["PRINCIPAL", "ICT_ADMIN"] as const;

/**
 * Status of the biweekly school backup snapshot (Head Teacher + ICT).
 * GET — read status / ensure snapshot exists for current period.
 * POST — force regenerate for current period.
 */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      { allowedRoles: [...ALLOWED], requireSchool: true },
      req,
    );
    if (!access.ok) return access.response;

    const rate = await applyRateLimit({
      key: `school-backup-status:${access.context.userId}`,
      limit: 30,
      windowMs: 60_000,
      failOpen: false,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const schoolId = access.context.schoolId!;
    const periodId = biweeklyPeriodId();
    let snapshot = await getSchoolBackupSnapshot(schoolId, periodId);

    // Lazy create once per period so leadership always has a download ready.
    if (!snapshot && isRedisConfigured()) {
      snapshot = await ensureSchoolBackupSnapshot({
        schoolId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        redisConfigured: isRedisConfigured(),
        periodId,
        periodLabel: biweeklyPeriodLabel(periodId),
        retentionDays: Math.round(REDIS_TTL.schoolBackupSnapshotSec / 86400),
        periodDays: 14,
        available: Boolean(snapshot),
        snapshot: snapshot
          ? {
              schoolName: snapshot.schoolName,
              generatedAt: snapshot.generatedAt,
              expiresAt: snapshot.expiresAt,
              periodLabel: snapshot.periodLabel,
              metrics: snapshot.metrics,
            }
          : null,
        downloadPath: "/api/admin/school-backup/download",
        note: snapshot
          ? "Aggregate backup is ready. It auto-deletes after 7 days to save storage."
          : "Redis is required to store temporary backups. Configure Upstash, then refresh.",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load backup status") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      { allowedRoles: [...ALLOWED], requireSchool: true },
      req,
    );
    if (!access.ok) return access.response;

    const rate = await applyRateLimit({
      key: `school-backup-gen:${getClientIp(req)}:${access.context.userId}`,
      limit: 5,
      windowMs: 60_000,
      failOpen: false,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { error: "Upstash Redis is required for temporary school backups." },
        { status: 503 },
      );
    }

    const snapshot = await ensureSchoolBackupSnapshot({
      schoolId: access.context.schoolId!,
      force: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        periodId: snapshot.periodId,
        periodLabel: snapshot.periodLabel,
        generatedAt: snapshot.generatedAt,
        expiresAt: snapshot.expiresAt,
        downloadPath: "/api/admin/school-backup/download",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to generate backup") },
      { status: 500 },
    );
  }
}
