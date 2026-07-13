/**
 * School-level metrics cache (Upstash) so dashboard reloads do not re-query
 * Supabase for stable counts (students, teachers, classes, etc.).
 *
 * Keys auto-expire via REDIS_TTL.schoolMetricsSec. On write paths that change
 * enrolment/structure, call invalidateSchoolMetricsCache(schoolId).
 */

import {
  isRedisConfigured,
  redisDel,
  redisGetJson,
  redisSetJson,
} from "@/lib/redis/client";
import { schoolMetricsCacheKey } from "@/lib/redis/keys";
import { REDIS_TTL } from "@/lib/redis/ttl";

export type SchoolMetricsSnapshot = {
  schoolId: string;
  cachedAt: string;
  profileCounts: {
    total: number;
    student: number;
    teacher: number;
    parent: number;
    staff: number;
  };
  classCount: number;
  subjectCount: number;
  assignmentCount: number;
  pendingInvites: number;
  attendanceSnapshot: {
    presentRate: number;
    absent: number;
    late: number;
  };
  financeSnapshot: {
    collected: number;
    pending: number;
  };
  auditCount: number;
  source: "redis" | "supabase";
};

export async function getCachedSchoolMetrics(
  schoolId: string,
): Promise<SchoolMetricsSnapshot | null> {
  const id = String(schoolId || "").trim();
  if (!id || !isRedisConfigured()) return null;
  const cached = await redisGetJson<SchoolMetricsSnapshot>(
    schoolMetricsCacheKey(id),
  );
  if (!cached || cached.schoolId !== id) return null;
  return { ...cached, source: "redis" };
}

export async function setCachedSchoolMetrics(
  snapshot: Omit<SchoolMetricsSnapshot, "source" | "cachedAt"> & {
    cachedAt?: string;
  },
): Promise<boolean> {
  const id = String(snapshot.schoolId || "").trim();
  if (!id || !isRedisConfigured()) return false;
  const payload: SchoolMetricsSnapshot = {
    ...snapshot,
    schoolId: id,
    cachedAt: snapshot.cachedAt || new Date().toISOString(),
    source: "redis",
  };
  return redisSetJson(
    schoolMetricsCacheKey(id),
    payload,
    REDIS_TTL.schoolMetricsSec,
  );
}

export async function invalidateSchoolMetricsCache(
  schoolId: string | null | undefined,
): Promise<void> {
  const id = String(schoolId || "").trim();
  if (!id || !isRedisConfigured()) return;
  await redisDel(schoolMetricsCacheKey(id));
}
