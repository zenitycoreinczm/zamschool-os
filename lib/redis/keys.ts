/**
 * Approved Redis key prefixes (Upstash free-tier discipline).
 * Anything outside these prefixes is rejected at runtime.
 *
 * Web-app roles covered:
 * - rl:     rate limits + login lockouts (sliding window / counters)
 * - role:   actor role/school snapshot (auth hot path)
 * - sess:   active session metadata (not Supabase JWT)
 * - tmp:    short-lived tokens, OTP throttle, email attestation,
 *           biweekly school backup snapshots (7-day auto-delete)
 * - daily:  daily feature quotas
 * - shell:  shell bootstrap payload cache
 * - ws:     workspace stable context + school metrics (counts) cache
 */

export const REDIS_KEY_PREFIX = {
  rateLimit: "rl:",
  role: "role:",
  session: "sess:",
  temp: "tmp:",
  daily: "daily:",
  shell: "shell:",
  ws: "ws:",
} as const;

const ALLOWED_PREFIXES = Object.values(REDIS_KEY_PREFIX);

/**
 * Hash PII (emails, IPs) before embedding in key names.
 * Pure JS so this module is safe to import from client components
 * (e.g. login page → profile-lookup → invalidate-actor-caches → keys).
 * Not a password hash - only for opaque Redis key segments.
 */
export function hashRedisIdentifier(value: string): string {
  const input = String(value || "").trim().toLowerCase();
  // FNV-1a variants mixed into 128 bits of hex (32 chars).
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5 ^ 0x9e3779b9;
  let h3 = 0x811c9dc5 ^ 0x85ebca6b;
  let h4 = 0x811c9dc5 ^ 0xc2b2ae35;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ (c + i), 0x01000193);
    h3 = Math.imul(h3 ^ (c * 31 + i), 0x01000193);
    h4 = Math.imul(h4 ^ ((c << 1) ^ i), 0x01000193);
  }
  const part = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${part(h1)}${part(h2)}${part(h3)}${part(h4)}`;
}

export function isApprovedRedisKey(key: string): boolean {
  const normalized = String(key || "").trim();
  if (!normalized || normalized.length > 200) return false;
  return ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function roleCacheKey(userId: string) {
  return `${REDIS_KEY_PREFIX.role}${String(userId || "").trim()}`;
}

export function sessionMetaKey(userId: string) {
  return `${REDIS_KEY_PREFIX.session}${String(userId || "").trim()}`;
}

export function tempOtpThrottleKey(email: string) {
  return `${REDIS_KEY_PREFIX.temp}otp:throttle:${hashRedisIdentifier(email)}`;
}

export function tempTokenKey(kind: string, id: string) {
  return `${REDIS_KEY_PREFIX.temp}${kind}:${String(id || "").trim()}`;
}

export function tempEmailVerifiedKey(userId: string) {
  return `${REDIS_KEY_PREFIX.temp}email-verified:${String(userId || "").trim()}`;
}

export function rateLimitKey(scope: string, identifier: string) {
  // Identifiers may contain emails or long tokens - hash those; keep short opaque ids.
  const safeScope = String(scope || "default")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "_")
    .slice(0, 80);
  const id = String(identifier || "").trim();
  const safeId =
    id.includes("@") || id.length > 48 ? hashRedisIdentifier(id) : id.slice(0, 80);
  return `${REDIS_KEY_PREFIX.rateLimit}${safeScope}:${safeId}`;
}

/** Failed password attempts for an email (hashed). */
export function loginFailureEmailKey(email: string) {
  return `${REDIS_KEY_PREFIX.rateLimit}login:email:${hashRedisIdentifier(email)}`;
}

/** Failed password attempts for a client IP. */
export function loginFailureIpKey(ip: string) {
  return `${REDIS_KEY_PREFIX.rateLimit}login:ip:${hashRedisIdentifier(ip)}`;
}

export function dailyUsageKey(feature: string, userId: string, day: string) {
  return `${REDIS_KEY_PREFIX.daily}${feature}:${userId}:${day}`;
}

export function shellCacheKey(userId: string, schoolId: string | null) {
  return `${REDIS_KEY_PREFIX.shell}${userId}:${schoolId || "none"}`;
}

export function workspaceCacheKey(userId: string, schoolId: string | null) {
  return `${REDIS_KEY_PREFIX.ws}${userId}:${schoolId || "none"}`;
}

/** School-wide stable metrics (student/teacher/class counts) - shared across reloads. */
export function schoolMetricsCacheKey(schoolId: string) {
  return `${REDIS_KEY_PREFIX.ws}metrics:${String(schoolId || "").trim()}`;
}

/** Biweekly aggregate backup snapshot for Head Teacher / ICT (auto-expires). */
export function schoolBackupSnapshotKey(schoolId: string, periodId: string) {
  return `${REDIS_KEY_PREFIX.temp}school-snap:${String(schoolId || "").trim()}:${String(periodId || "").trim()}`;
}
