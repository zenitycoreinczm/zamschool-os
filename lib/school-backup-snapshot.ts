/**
 * Biweekly school backup snapshot for Head Teacher + ICT Admin.
 *
 * - Aggregate metrics only (never full student lists) → small Redis payload.
 * - Generated once per 14-day period; stored under tmp: with 7-day TTL (auto-delete).
 * - PDF is rendered on download so binaries are not stored in Upstash.
 */

import {
  isRedisConfigured,
  redisGetJson,
  redisSetJson,
} from "@/lib/redis/client";
import { schoolBackupSnapshotKey } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";
import type { SchoolMetricsSnapshot } from "@/lib/school-metrics-cache";
import {
  getCachedSchoolMetrics,
  setCachedSchoolMetrics,
} from "@/lib/school-metrics-cache";

const PERIOD_MS = 14 * 24 * 60 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export type SchoolBackupSnapshot = {
  schoolId: string;
  schoolName: string;
  periodId: string;
  periodLabel: string;
  generatedAt: string;
  expiresAt: string;
  metrics: SchoolMetricsSnapshot["profileCounts"] & {
    classCount: number;
    subjectCount: number;
    assignmentCount: number;
    pendingInvites: number;
    attendancePresentRate: number;
    attendanceAbsent: number;
    financeCollected: number;
    financePending: number;
    auditCount7d: number;
  };
};

export function biweeklyPeriodId(now = Date.now()): string {
  return `bw-${Math.floor(now / PERIOD_MS)}`;
}

export function biweeklyPeriodLabel(periodId: string): string {
  const n = Number(String(periodId).replace(/^bw-/, ""));
  if (!Number.isFinite(n)) return periodId;
  const start = new Date(n * PERIOD_MS);
  const end = new Date((n + 1) * PERIOD_MS - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-ZM", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

export async function getSchoolBackupSnapshot(
  schoolId: string,
  periodId = biweeklyPeriodId(),
): Promise<SchoolBackupSnapshot | null> {
  const id = String(schoolId || "").trim();
  if (!id || !isRedisConfigured()) return null;
  return redisGetJson<SchoolBackupSnapshot>(
    schoolBackupSnapshotKey(id, periodId),
  );
}

export async function ensureSchoolBackupSnapshot(input: {
  schoolId: string;
  schoolName?: string | null;
  /** When true, rebuild even if a snapshot already exists for the period. */
  force?: boolean;
  /** Optional metrics already loaded (avoids double work). */
  metrics?: SchoolMetricsSnapshot | null;
}): Promise<SchoolBackupSnapshot> {
  const schoolId = String(input.schoolId || "").trim();
  if (!schoolId) throw new Error("School is required");

  const periodId = biweeklyPeriodId();
  if (!input.force) {
    const existing = await getSchoolBackupSnapshot(schoolId, periodId);
    if (existing) return existing;
  }

  let metrics = input.metrics || (await getCachedSchoolMetrics(schoolId));
  if (!metrics) {
    // Build once from Supabase via workspace summary loaders path
    const { loadSchoolMetricsFromSupabase } = await import(
      "@/lib/workspace/summary"
    );
    metrics = await loadSchoolMetricsFromSupabase(schoolId);
    await setCachedSchoolMetrics(metrics);
  }

  const schoolName =
    String(input.schoolName || "").trim() ||
    (await loadSchoolName(schoolId)) ||
    "School";

  const now = Date.now();
  const snapshot: SchoolBackupSnapshot = {
    schoolId,
    schoolName,
    periodId,
    periodLabel: biweeklyPeriodLabel(periodId),
    generatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + RETENTION_MS).toISOString(),
    metrics: {
      total: metrics.profileCounts.total,
      student: metrics.profileCounts.student,
      teacher: metrics.profileCounts.teacher,
      parent: metrics.profileCounts.parent,
      staff: metrics.profileCounts.staff,
      classCount: metrics.classCount,
      subjectCount: metrics.subjectCount,
      assignmentCount: metrics.assignmentCount,
      pendingInvites: metrics.pendingInvites,
      attendancePresentRate: metrics.attendanceSnapshot.presentRate,
      attendanceAbsent: metrics.attendanceSnapshot.absent,
      financeCollected: metrics.financeSnapshot.collected,
      financePending: metrics.financeSnapshot.pending,
      auditCount7d: metrics.auditCount,
    },
  };

  if (isRedisConfigured()) {
    await redisSetJson(
      schoolBackupSnapshotKey(schoolId, periodId),
      snapshot,
      REDIS_TTL.schoolBackupSnapshotSec,
    );
  }

  return snapshot;
}

async function loadSchoolName(schoolId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/lib/supabase");
  const { data } = await supabaseAdmin
    .from("schools")
    .select("name")
    .eq("id", schoolId)
    .maybeSingle();
  return data?.name ? String(data.name) : null;
}

/** Minimal PDF 1.4 (text only) - no external deps. */
export function buildSchoolBackupPdf(snapshot: SchoolBackupSnapshot): Uint8Array {
  const lines = [
    "ZamSchool OS - School backup summary",
    "====================================",
    "",
    `School: ${snapshot.schoolName}`,
    `Period: ${snapshot.periodLabel} (${snapshot.periodId})`,
    `Generated: ${snapshot.generatedAt}`,
    `Auto-deletes: ${snapshot.expiresAt}`,
    "",
    "Enrolment & staff (aggregates only)",
    "----------------------------------",
    `Students: ${snapshot.metrics.student}`,
    `Teachers: ${snapshot.metrics.teacher}`,
    `Parents: ${snapshot.metrics.parent}`,
    `Staff (office): ${snapshot.metrics.staff}`,
    `Total accounts: ${snapshot.metrics.total}`,
    "",
    "Structure",
    "--------",
    `Classes: ${snapshot.metrics.classCount}`,
    `Subjects: ${snapshot.metrics.subjectCount}`,
    `Assignments: ${snapshot.metrics.assignmentCount}`,
    `Pending invites: ${snapshot.metrics.pendingInvites}`,
    "",
    "Attendance (7-day window at generation)",
    "--------------------------------------",
    `Present rate: ${snapshot.metrics.attendancePresentRate}%`,
    `Absent marks: ${snapshot.metrics.attendanceAbsent}`,
    "",
    "Finance (snapshot)",
    "------------------",
    `Collected: ${snapshot.metrics.financeCollected}`,
    `Outstanding: ${snapshot.metrics.financePending}`,
    "",
    `Audit events (7d): ${snapshot.metrics.auditCount7d}`,
    "",
    "Note: This is an aggregate backup for Head Teacher / ICT Admin.",
    "Full learner records remain in the live system of record.",
    "This file is not stored permanently - regenerate next period if needed.",
  ];

  return encodeSimplePdf(lines);
}

function encodeSimplePdf(lines: string[]): Uint8Array {
  // Escape PDF string specials
  const escape = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const contentLines = ["BT", "/F1 11 Tf", "50 780 Td", "14 TL"];
  lines.forEach((line, i) => {
    if (i === 0) {
      contentLines.push(`(${escape(line)}) Tj`);
    } else {
      contentLines.push("T*");
      contentLines.push(`(${escape(line)}) Tj`);
    }
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push(
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
  );
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
  );
  objects.push(
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push(
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  );

  const encoder = new TextEncoder();
  const byteLen = (s: string) => encoder.encode(s).length;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(byteLen(pdf));
    pdf += obj;
  }
  const xrefPos = byteLen(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF`;

  return encoder.encode(pdf);
}
