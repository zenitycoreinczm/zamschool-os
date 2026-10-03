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

export type TenantScope =
  | string
  | null
  | undefined
  | { schoolId?: string | null };

function resolveTenantSchoolId(scope: TenantScope): string {
  return requireTenantId(typeof scope === "string" ? scope : scope?.schoolId);
}

/**
 * Minimal shape of a PostgREST query builder. Declared with method syntax on
 * purpose: supabase-js types `.eq()` against a column-name union, and only
 * method-style declarations get bivariant parameter checking, so a real
 * builder satisfies this while a property-style signature would not.
 */
type SchoolScopable = {
  eq(column: string, value: string): unknown;
};

/**
 * Appends the tenant filter to a service-role query. Throws rather than
 * returning an unscoped query, because service-role clients bypass RLS.
 *
 * `Q` is intentionally left unconstrained. Constraining it to a structural
 * `{ eq(...) }` shape makes TypeScript instantiate the whole PostgREST builder
 * and fail with TS2589 ("excessively deep") at real call sites, so the shape is
 * asserted internally instead. Supabase's `.eq()` returns the same builder, so
 * the returned reference stays chainable.
 *
 * Do not apply this to `profiles` reads whose ids already came from a
 * school-scoped query: `profiles.school_id` is nullable, so an added filter
 * silently drops platform admins and unaccepted invitations.
 */
export function withSchoolScope<Q>(query: Q, scope: TenantScope): Q {
  (query as unknown as SchoolScopable).eq("school_id", resolveTenantSchoolId(scope));
  return query;
}

export function withTenantFilter<Q>(query: Q, schoolId: string): Q {
  return withSchoolScope(query, schoolId);
}

/**
 * Fail-closed tenant id for callers that need to append the filter inline
 * (conditional query builders where wrapping the builder is awkward).
 */
export function schoolScopeParam(scope: TenantScope): string {
  return resolveTenantSchoolId(scope);
}
