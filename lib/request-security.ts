/**
 * Edge-safe request security helpers (bot heuristics, scanner path blocks,
 * hardened response headers). Used by middleware (proxy.ts) and auth routes.
 */

const ATTACK_PATH_PATTERNS: RegExp[] = [
  /\/\.env(?:\.|$)/i,
  /\/\.git(?:\/|$)/i,
  /\/\.svn(?:\/|$)/i,
  /\/\.htaccess$/i,
  /\/wp-admin(?:\/|$)/i,
  /\/wp-login\.php$/i,
  /\/wp-content(?:\/|$)/i,
  /\/xmlrpc\.php$/i,
  /\/phpmyadmin(?:\/|$)/i,
  /\/adminer(?:\.php)?(?:\/|$)/i,
  /\/cgi-bin(?:\/|$)/i,
  /\/vendor\/phpunit/i,
  /\/\.aws(?:\/|$)/i,
  /\/server-status(?:\/|$)/i,
  /\/actuator(?:\/|$)/i,
  /\/(config|backup|dump|database)\.(sql|zip|tar|gz|bak|old)$/i,
  /\/(shell|cmd|eval|passthru)\.php$/i,
  /%2e%2e|%252e|\.\.[\\/]/i,
];

/** Known malicious / non-browser automation UAs that should not hit auth surfaces. */
const BLOCKED_UA_PATTERNS: RegExp[] = [
  /sqlmap/i,
  /nikto/i,
  /nmap/i,
  /masscan/i,
  /zgrab/i,
  /dirbuster/i,
  /gobuster/i,
  /wpscan/i,
  /acunetix/i,
  /nessus/i,
  /havij/i,
  /libwww-perl/i,
  /python-requests/i,
  /python-urllib/i,
  /go-http-client/i,
  /java\//i,
  /scrapy/i,
  /httpclient/i,
  /curl\//i,
  /wget\//i,
  /httpie/i,
  /postmanruntime/i,
  /insomnia/i,
  /phantomjs/i,
];

/** Legitimate monitoring may use simple UAs — allow only on health probes. */
const HEALTH_PATHS = new Set(["/api/health", "/api/health/ready"]);

const SENSITIVE_PREFIXES = [
  "/api/auth",
  "/api/staff/invitations",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/accept-invitation",
  "/join",
];

export function isBlockedAttackPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || pathname).toLowerCase();
  if (!path || path === "/") return false;
  return ATTACK_PATH_PATTERNS.some((re) => re.test(path));
}

export function isSensitiveAuthSurface(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  return SENSITIVE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export type BotClassification = {
  /** Hard block — return 403 */
  block: boolean;
  /** Soft signal for stricter rate limits */
  suspicious: boolean;
  reason: string | null;
  score: number;
};

/**
 * Score automated / abusive clients. Browsers score 0.
 * On sensitive auth surfaces, known scanner UAs and empty UAs are blocked.
 * Health probes with empty UA remain allowed.
 */
export function classifyClientBot(params: {
  userAgent: string | null | undefined;
  pathname: string;
  method?: string;
}): BotClassification {
  const ua = String(params.userAgent || "").trim();
  const path = params.pathname.split("?")[0] || params.pathname;
  const sensitive = isSensitiveAuthSurface(path);
  const isHealth = HEALTH_PATHS.has(path);

  let score = 0;
  let reason: string | null = null;

  if (!ua || ua.length < 8) {
    score += sensitive ? 80 : 40;
    reason = "missing_or_short_user_agent";
  } else {
    for (const re of BLOCKED_UA_PATTERNS) {
      if (re.test(ua)) {
        score += 90;
        reason = "blocked_automation_user_agent";
        break;
      }
    }
  }

  // Extremely long UAs are sometimes used in header injection probes.
  if (ua.length > 512) {
    score += 50;
    reason = reason || "oversized_user_agent";
  }

  if (isHealth && score < 100) {
    return { block: false, suspicious: false, reason: null, score: 0 };
  }

  // In development, allow curl/postman so engineers can test APIs.
  if (process.env.NODE_ENV === "development" && score < 100) {
    return {
      block: false,
      suspicious: score >= 40,
      reason,
      score,
    };
  }

  const block = sensitive ? score >= 70 : score >= 100;

  return {
    block,
    suspicious: score >= 40,
    reason: block || score >= 40 ? reason : null,
    score,
  };
}

/**
 * Same-origin relative redirects only. Blocks open redirects:
 * //evil.com, /\\evil.com, http://..., javascript:, etc.
 */
export function isSafeInternalPath(
  redirectTo: string | null | undefined,
): redirectTo is string {
  if (typeof redirectTo !== "string") return false;
  const value = redirectTo.trim();
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.startsWith("/\\") || value.startsWith("/\\\\")) return false;
  if (value.includes("://")) return false;
  if (value.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) return false; // scheme-relative edge cases
  // Disallow encoded path tricks that decode to //host
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || decoded.includes("://")) return false;
  } catch {
    return false;
  }
  return value.length <= 512;
}

export const HARDENED_SECURITY_HEADERS: Record<string, string> = {
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-DNS-Prefetch-Control": "off",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-site",
};

/**
 * Lightweight per-isolate flood guard for middleware (complements Redis on routes).
 */
const floodBuckets = new Map<string, number[]>();
const FLOOD_CLEANUP_MS = 60_000;
let lastFloodCleanup = 0;

export function checkMiddlewareFloodLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  if (now - lastFloodCleanup > FLOOD_CLEANUP_MS) {
    lastFloodCleanup = now;
    for (const [k, stamps] of floodBuckets) {
      const kept = stamps.filter((t) => t > now - params.windowMs * 2);
      if (kept.length === 0) floodBuckets.delete(k);
      else floodBuckets.set(k, kept);
    }
  }

  const windowStart = now - params.windowMs;
  const kept = (floodBuckets.get(params.key) || []).filter((t) => t > windowStart);
  if (kept.length >= params.limit) {
    floodBuckets.set(params.key, kept);
    const oldest = kept[0] ?? now;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + params.windowMs - now) / 1000)),
    };
  }
  kept.push(now);
  floodBuckets.set(params.key, kept);
  return { allowed: true, retryAfterSec: 0 };
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "unknown";
}
