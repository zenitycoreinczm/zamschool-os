import { getClientIp } from "@/lib/server-guards";

/**
 * Canonical helpers for tenant-scoped backend execution.
 *
 * This module exists to prevent architectural drift across API routes,
 * worker helpers, and server-side mutations. All new tenant-aware keying
 * and school-scoped filters should compose these helpers rather than invent
 * parallel patterns.
 */

export function requireTenantId(schoolId: string | null | undefined): string {
  const normalized = typeof schoolId === "string" ? schoolId.trim() : "";
  if (!normalized) {
    throw new Error("Missing tenant school_id");
  }
  return normalized;
}

export function tenantRateLimitScope(scope: string, schoolId: string): string {
  return `tenant:${requireTenantId(schoolId)}:${scope}`;
}

export function tenantActorRateLimitKey(params: {
  scope: string;
  schoolId: string | null;
  req: Request;
  userId?: string | null;
}) {
  const scoped = tenantRateLimitScope(params.scope, params.schoolId ?? "");
  if (params.userId) {
    return `${scoped}:user:${params.userId}`;
  }
  return `${scoped}:ip:${getClientIp(params.req)}`;
}

export function withTenantFilter<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  schoolId: string,
) {
  return query.eq("school_id", requireTenantId(schoolId));
}
