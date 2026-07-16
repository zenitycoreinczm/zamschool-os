/**
 * Shared types for Cloudflare Worker bindings.
 */
export interface Env {
  // R2 buckets
  ASSETS_BUCKET: R2Bucket;
  UPLOADS_BUCKET: R2Bucket;

  // KV namespaces
  SESSION_CACHE: KVNamespace;
  RATE_LIMITS: KVNamespace;

  // D1 database (optional offline read-replica - currently stubbed)
  SCHOOL_DB?: D1Database;

  // Durable Objects
  SYNC_QUEUE: DurableObjectNamespace;

  // Config vars (non-secret - see wrangler.toml / README)
  UPSTREAM_API: string;
  CORS_ALLOWED_ORIGINS?: string;
  /** Set via `wrangler secret put SUPABASE_JWT_SECRET` when using HS256 legacy secret. */
  SUPABASE_JWT_SECRET?: string;
  /** Optional issuer check, e.g. https://<project-ref>.supabase.co/auth/v1 */
  SUPABASE_JWT_ISSUER?: string;
  /** Project URL for JWKS discovery (ES256). e.g. https://xxx.supabase.co */
  SUPABASE_URL?: string;
  /** Override JWKS URL (defaults to {issuer}/.well-known/jwks.json). */
  SUPABASE_JWKS_URL?: string;
  /** Defaults to "authenticated" when unset. */
  SUPABASE_JWT_AUDIENCE?: string;
  /** signature (default when secret set) | decode (local only with ALLOW_INSECURE_JWT_DECODE) */
  JWT_VERIFY_MODE?: string;
  /** Must be "true" to allow decode mode - never enable in production. */
  ALLOW_INSECURE_JWT_DECODE?: string;
  /** Set to "true" to enable KV rate limiting at the edge. */
  RATE_LIMIT_ENABLED?: string;
  /** Environment mode: "production" | "development" | "test" */
  NODE_ENV?: string;
  /** Vercel environment: "production" | "preview" | "development" */
  VERCEL_ENV?: string;

  // Test injection
  fetch?: typeof fetch;
}

/** Shape of session snapshot stored in KV */
export interface SessionSnapshot {
  userId: string;
  role: string;
  schoolId: string;
  email: string;
  exp: number; // unix timestamp (seconds)
}

/** Shape of a queued mutation */
export interface QueuedMutation {
  id: string;
  schoolId: string;
  userId: string;
  method: string;
  path: string;
  body: unknown;
  timestamp: number;
  /** Original Authorization header (Bearer <token>) stored during enqueue,
   *  replayed during flush so the delayed mutation still authenticates. */
  authHeader?: string;
}

/** Routes the gateway handles directly (not proxied). */
export const GATEWAY_NATIVE_ROUTES = {
  upload: "/api/upload",
  fileDownloadPrefix: "/api/files/",
} as const;

/**
 * GET routes safe to cache at the edge (never auth, attendance, or results).
 * Align with lib/edge-cache.ts - sensitive reads must stay no-store upstream.
 */
export const CACHEABLE_GET_PREFIXES = [
  "/api/admin/classes",
  "/api/admin/subjects",
  "/api/admin/announcements",
  "/api/admin/terms",
  "/api/admin/school",
  "/api/teacher/dashboard",
  "/api/teacher/classes",
  "/api/teacher/announcements",
  "/api/teacher/events",
  "/api/teacher/students",
  "/api/student/dashboard",
  "/api/parent/children",
  "/api/account/workspace-context",
  "/api/account/announcements",
  "/api/account/events",
  "/api/dashboard/summary",
  "/api/payments/shell-summary",
] as const;

/** Routes where offline mutations are allowed (queued) */
export const QUEUABLE_MUTATION_PATHS = [
  "/api/teacher/attendance",
  "/api/teacher/announcements",
  "/api/admin/announcements",
  "/api/admin/attendance",
  "/api/admin/classes",
  "/api/teacher/results",
  "/api/student/profile",
  "/api/payments/billing",
] as const;

export function isCacheableGetPath(pathname: string): boolean {
  return CACHEABLE_GET_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
  );
}

export function isQueuableMutationPath(pathname: string): boolean {
  return QUEUABLE_MUTATION_PATHS.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
