import { NextResponse } from "next/server";

import { applyRateLimit, getClientIp, safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import {
  buildSchoolBackupPdf,
  ensureSchoolBackupSnapshot,
} from "@/lib/school-backup-snapshot";
import { isRedisConfigured } from "@/lib/redis/client";

const ALLOWED = ["PRINCIPAL", "ICT_ADMIN"] as const;

/**
 * Download biweekly school aggregate backup as PDF.
 * Snapshot lives in Upstash for 7 days then auto-deletes.
 */
export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      { allowedRoles: [...ALLOWED], requireSchool: true },
      req,
    );
    if (!access.ok) return access.response;

    const rate = await applyRateLimit({
      key: `school-backup-dl:${getClientIp(req)}:${access.context.userId}`,
      limit: 10,
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
    });

    const pdf = buildSchoolBackupPdf(snapshot);
    const safeName = snapshot.schoolName
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const filename = `zamschool-backup-${safeName || "school"}-${snapshot.periodId}.pdf`;

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Backup-Expires": snapshot.expiresAt,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to download backup") },
      { status: 500 },
    );
  }
}
