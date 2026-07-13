const KV_REST_API_URL = (process.env.KV_REST_API_URL || "").trim();
const KV_REST_API_TOKEN = (process.env.KV_REST_API_TOKEN || "").trim();

type RateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

const LIMITS: Record<string, RateLimitConfig> = {
  api: { maxRequests: 100, windowMs: 60 * 1000 },
  auth: { maxRequests: 10, windowMs: 60 * 1000 },
  image_uploads: { maxRequests: 20, windowMs: 60 * 1000 },
  file_upload: { maxRequests: 20, windowMs: 60 * 1000 },
};

/**
 * Detects KV env misconfiguration that would silently swallow errors.
 *
 * Cloudflare Workers KV REST URL must look like:
 *   https://api.cloudflare.com/client/v4/accounts/<acc>/storage/kv/<namespace>
 *
 * It must NOT be the R2 S3 endpoint, which has the form
 *   https://<account>.r2.cloudflarestorage.com
 *   https://<namespace>.kv.cloudflarestorage.com
 * Both resolve to an S3-style API that 404s (or DNS-fails if the namespace
 * doesn't exist) on every KV call.
 *
 * When we detect this, we treat KV as unconfigured so rate-limit() falls through
 * to the in-memory/Redis fallback instead of emitting a noisy `fetch failed`
 * for every request.
 */
const R2_S3_HOST_PATTERN = /\.(r2|kv)\.cloudflarestorage\.com$/i;
let warnedKvEndpointFormat = false;
let warnedKvAuthFailure = false;
/** Soft-disable after auth failures so we do not hammer a bad token. */
let kvAuthDisabledUntil = 0;
const KV_AUTH_COOLDOWN_MS = 10 * 60 * 1000;

function looksLikeValidKvRestUrl(rawUrl: string): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    if (R2_S3_HOST_PATTERN.test(parsed.hostname)) return false;
    // Workers KV REST API always goes through api.cloudflare.com.
    return parsed.hostname === "api.cloudflare.com";
  } catch {
    return false;
  }
}

function markKvAuthFailure(status: number) {
  if (status !== 401 && status !== 403) return;
  kvAuthDisabledUntil = Date.now() + KV_AUTH_COOLDOWN_MS;
  if (!warnedKvAuthFailure && process.env.NODE_ENV !== "test") {
    warnedKvAuthFailure = true;
    console.warn(
      "[KV] Cloudflare KV REST returned " +
        status +
        " — token lacks Workers KV edit permission or IP is blocked. " +
        "Disabling KV for 10m; Upstash Redis remains the primary rate-limit backend.",
    );
  }
}

export function isKvConfigured(): boolean {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return false;
  if (Date.now() < kvAuthDisabledUntil) return false;
  if (!looksLikeValidKvRestUrl(KV_REST_API_URL)) {
    if (!warnedKvEndpointFormat && process.env.NODE_ENV !== "test") {
      warnedKvEndpointFormat = true;
      console.warn(
        "[KV] KV_REST_API_URL is not a Workers KV REST endpoint " +
          "(expected https://api.cloudflare.com/client/v4/accounts/<acc>/storage/kv/<namespace>). " +
          "If you meant R2 storage, point at the WORKERS KV REST endpoint instead. " +
          "Falling back to Redis/in-memory rate limit on every call.",
      );
    }
    return false;
  }
  return true;
}

async function kvGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${KV_REST_API_URL}/values/${encodeURIComponent(key)}`,
      {
        headers: { Authorization: `Bearer ${KV_REST_API_TOKEN}` },
      },
    );
    if (res.status === 401 || res.status === 403) {
      markKvAuthFailure(res.status);
      return null;
    }
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function kvPut(
  key: string,
  value: string,
  expirationTtl?: number,
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
    };
    if (expirationTtl) {
      headers["Expiration-TTL"] = String(expirationTtl);
    }
    const res = await fetch(
      `${KV_REST_API_URL}/values/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        headers,
        body: value,
      },
    );
    if (res.status === 401 || res.status === 403) {
      markKvAuthFailure(res.status);
      return false;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

export async function checkKvRateLimit(
  identifier: string,
  category: keyof typeof LIMITS,
): Promise<RateLimitResult> {
  if (!isKvConfigured()) {
    return { allowed: true, remaining: 999, reset: 0 };
  }

  const config = LIMITS[category];
  if (!config) {
    return { allowed: true, remaining: 999, reset: 0 };
  }

  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const kvKey = `rate_limit:${category}:${identifier}:${windowStart}`;
  const ttl = Math.ceil(config.windowMs / 1000);

  try {
    const currentVal = await kvGet(kvKey);
    const count = currentVal ? parseInt(currentVal, 10) : 0;

    if (count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        reset: windowStart + config.windowMs,
      };
    }

    await kvPut(kvKey, String(count + 1), ttl);

    return {
      allowed: true,
      remaining: config.maxRequests - count - 1,
      reset: windowStart + config.windowMs,
    };
  } catch {
    return { allowed: true, remaining: 999, reset: 0 };
  }
}

export async function checkKvBurstLimit(
  userId: string,
  operation: string,
  maxConcurrent: number = 3,
): Promise<{ allowed: boolean }> {
  if (!isKvConfigured()) {
    return { allowed: true };
  }

  const kvKey = `burst:${operation}:${userId}`;

  try {
    const currentVal = await kvGet(kvKey);
    const current = currentVal ? parseInt(currentVal, 10) : 0;

    if (current >= maxConcurrent) {
      return { allowed: false };
    }

    await kvPut(kvKey, String(current + 1), 60);
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function releaseKvBurstLimit(
  userId: string,
  operation: string,
): Promise<void> {
  if (!isKvConfigured()) return;

  const kvKey = `burst:${operation}:${userId}`;

  try {
    const currentVal = await kvGet(kvKey);
    const current = currentVal ? parseInt(currentVal, 10) : 0;
    if (current > 0) {
      await kvPut(kvKey, String(current - 1), 60);
    }
  } catch {
    // fail silently
  }
}
