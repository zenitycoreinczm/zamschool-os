/**
 * Edge-safe request security helpers (bot heuristics, scanner path blocks,
 * hardened response headers). Used by middleware (proxy.ts) and auth routes.
 */

const ATTACK_PATH_PATTERNS: RegExp[] = [
  /\/\.env(?:\.|$)/i,
  /\/\.git(?:\/|$)/i,
  /\/\.svn(?:\/|$)/i,
  /\/\.hg(?:\/|$)/i,
  /\/\.bzr(?:\/|$)/i,
  /\/\.htaccess$/i,
  /\/\.htpasswd$/i,
  /\/\.DS_Store$/i,
  /\/wp-admin(?:\/|$)/i,
  /\/wp-login\.php$/i,
  /\/wp-content(?:\/|$)/i,
  /\/wp-includes(?:\/|$)/i,
  /\/xmlrpc\.php$/i,
  /\/phpmyadmin(?:\/|$)/i,
  /\/adminer(?:\.php)?(?:\/|$)/i,
  /\/cgi-bin(?:\/|$)/i,
  /\/vendor\/phpunit/i,
  /\/\.aws(?:\/|$)/i,
  /\/\.ssh(?:\/|$)/i,
  /\/\.docker(?:\/|$)/i,
  /\/server-status(?:\/|$)/i,
  /\/server-info(?:\/|$)/i,
  /\/actuator(?:\/|$)/i,
  /\/debug\/(?:default|pprof|vars)/i,
  /\/_profiler(?:\/|$)/i,
  /\/telescope(?:\/|$)/i,
  /\/horizon(?:\/|$)/i,
  /\/(config|backup|dump|database|credentials|secrets)\.(sql|zip|tar|gz|bak|old|env|yml|yaml|json|xml)$/i,
  /\/(shell|cmd|eval|passthru|phpinfo)\.php$/i,
  /\/(id_rsa|id_dsa|authorized_keys)$/i,
  /\/(web\.config|composer\.(json|lock)|package-lock\.json)$/i,
  /%2e%2e|%252e|\.\.[\\/]/i,
  /\/(etc\/passwd|proc\/self\/environ)/i,
];

/**
 * Known malicious / non-browser automation UAs.
 * These are hard-blocked site-wide (except health probes) - not only on login.
 */
const BLOCKED_AUTOMATION_UA_PATTERNS: RegExp[] = [
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
  /python\//i,
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
  /headlesschrome/i,
  /puppeteer/i,
  /playwright/i,
  /selenium/i,
  /axios\//i,
  /node-fetch/i,
  /undici/i,
  /okhttp/i,
  /aiohttp/i,
  /mechanize/i,
];

/**
 * AI training / agent crawlers - always blocked (robots.txt is voluntary; we enforce).
 * These tools scrape product UI/layout for training or automated browsing.
 */
const BLOCKED_AI_SCRAPER_UA_PATTERNS: RegExp[] = [
  /GPTBot/i,
  /ChatGPT-User/i,
  /ChatGPT/i,
  /OAI-SearchBot/i,
  /ClaudeBot/i,
  /Claude-Web/i,
  /anthropic-ai/i,
  /anthropic/i,
  /CCBot/i,
  /Google-Extended/i,
  /Bytespider/i,
  /Amazonbot/i,
  /Applebot-Extended/i,
  /meta-externalagent/i,
  /FacebookBot/i,
  /cohere-ai/i,
  /Diffbot/i,
  /ImagesiftBot/i,
  /PerplexityBot/i,
  /YouBot/i,
  /PhindBot/i,
  /AI2Bot/i,
  /Webzio-Extended/i,
  /TimpiBot/i,
  /Timpibot/i,
  /iaskspider/i,
  /omgili/i,
  /Omgilibot/i,
  /PetalBot/i,
  /DataForSeoBot/i,
  /SemrushBot/i,
  /AhrefsBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /BLEXBot/i,
  /Barkrowler/i,
  /Seekport/i,
  /AwarioBot/i,
  /magpie-crawler/i,
  /TurnitinBot/i,
  /icc-crawler/i,
  /VelenPublicWebCrawler/i,
  /Scrapy/i,
  /DeepSeek/i,
  /Grok/i,
  /xAI/i,
];

/** SEO crawlers allowed only on public marketing/legal pages - never /app or /api. */
const SEO_CRAWLER_UA_PATTERNS: RegExp[] = [
  /Googlebot/i,
  /Google-InspectionTool/i,
  /bingbot/i,
  /DuckDuckBot/i,
  /Slurp/i,
  /Applebot(?!-Extended)/i,
  /YandexBot/i,
  /Baiduspider/i,
];

/** Public surface SEO bots may index (marketing only). */
const SEO_ALLOWED_PATHS = new Set([
  "/",
  "/privacy",
  "/terms",
  "/cookies",
  "/robots.txt",
  "/sitemap.xml",
  "/icon.png",
  "/favicon.ico",
]);

/** Legitimate monitoring may use simple UAs - allow only on health probes. */
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

/** Logged-in product + private APIs - never for scrapers / SEO bots. */
const PRIVATE_PRODUCT_PREFIXES = [
  "/app",
  "/api",
  "/dashboard",
  "/admin",
  "/teacher",
  "/student",
  "/parent",
  "/payments",
  "/super-admin",
  "/first-login",
  "/verify-email",
  "/login/mfa",
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

export function isPrivateProductSurface(pathname: string): boolean {
  const path = pathname.split("?")[0] || pathname;
  // Public auth endpoints under /api/auth/* still need protection but are not
  // "product workspace" - still blocked for AI scrapers via UA lists.
  if (path === "/api/health" || path === "/api/health/ready") return false;
  return PRIVATE_PRODUCT_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function isSeoAllowedPublicPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || pathname).toLowerCase();
  if (SEO_ALLOWED_PATHS.has(path)) return true;
  // Static public assets only
  if (path.startsWith("/_next/static/")) return true;
  if (path.startsWith("/.well-known/")) return true;
  return false;
}

export type BotClassification = {
  /** Hard block - return 403 */
  block: boolean;
  /** Soft signal for stricter rate limits */
  suspicious: boolean;
  reason: string | null;
  score: number;
};

function matchesAny(ua: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(ua));
}

/**
 * Score automated / abusive clients. Real browsers score 0.
 *
 * Policy:
 * - Health probes: always allowed (empty UA OK).
 * - AI training / agent scrapers: blocked everywhere.
 * - curl/python/scrapy/headless: blocked everywhere (except health; allowed in dev).
 * - SEO bots (Googlebot etc.): only public marketing paths - never /app or /api.
 * - Empty UA on auth or private product: blocked in production.
 */
export function classifyClientBot(params: {
  userAgent: string | null | undefined;
  pathname: string;
  method?: string;
}): BotClassification {
  const ua = String(params.userAgent || "").trim();
  const path = params.pathname.split("?")[0] || params.pathname;
  const sensitive = isSensitiveAuthSurface(path);
  const privateProduct = isPrivateProductSurface(path);
  const isHealth = HEALTH_PATHS.has(path);

  if (isHealth) {
    return { block: false, suspicious: false, reason: null, score: 0 };
  }

  let score = 0;
  let reason: string | null = null;

  // AI scrapers - always block (even if they look "Mozilla-like" with a token).
  if (ua && matchesAny(ua, BLOCKED_AI_SCRAPER_UA_PATTERNS)) {
    return {
      block: true,
      suspicious: true,
      reason: "ai_scraper_user_agent",
      score: 100,
    };
  }

  // Classic automation / scanners
  if (ua && matchesAny(ua, BLOCKED_AUTOMATION_UA_PATTERNS)) {
    score = 100;
    reason = "blocked_automation_user_agent";
  }

  // SEO crawlers: allow only marketing pages; block product + APIs.
  if (ua && matchesAny(ua, SEO_CRAWLER_UA_PATTERNS)) {
    if (!isSeoAllowedPublicPath(path)) {
      return {
        block: true,
        suspicious: true,
        reason: "seo_crawler_private_surface",
        score: 100,
      };
    }
    return { block: false, suspicious: false, reason: null, score: 0 };
  }

  if (!ua || ua.length < 12) {
    score = Math.max(score, sensitive || privateProduct ? 100 : 50);
    reason = reason || "missing_or_short_user_agent";
  }

  // Extremely long UAs are sometimes used in header injection probes.
  if (ua.length > 512) {
    score = Math.max(score, 80);
    reason = reason || "oversized_user_agent";
  }

  // No "Mozilla" + browser engine token → treat as non-browser on private surfaces.
  if (
    ua &&
    privateProduct &&
    !/mozilla\/\d/i.test(ua) &&
    score < 100
  ) {
    score = 100;
    reason = reason || "non_browser_private_surface";
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
  if (
    process.env.NODE_ENV === "development" &&
    reason === "blocked_automation_user_agent"
  ) {
    return {
      block: false,
      suspicious: true,
      reason,
      score,
    };
  }

  // Site-wide hard block for automation/AI (score 100).
  // Auth/private empty UA also blocked.
  const block = score >= 70;

  return {
    block,
    suspicious: score >= 40,
    reason: block || score >= 40 ? reason : null,
    score,
  };
}

/** Response headers that discourage AI training scrapers and private indexing. */
export function privateSurfaceRobotHeaders(): Record<string, string> {
  return {
    "X-Robots-Tag":
      "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai",
  };
}

export function publicSurfaceRobotHeaders(): Record<string, string> {
  // Public marketing may be indexed by search engines, but not used for AI training
  // where the crawler honours X-Robots-Tag (many AI bots do).
  return {
    "X-Robots-Tag": "noai, noimageai",
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
