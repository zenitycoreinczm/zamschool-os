import {
  normalizeLegacyDashboardPath,
  resolveRoleAwareProtectedPath,
  resolvePostLoginPath,
} from "./lib/auth-routing";
import { canAccessPath } from "./lib/middleware-path-access";
import { resolveVerifiedMiddlewareSession } from "./lib/middleware-supabase-session";
import {
  buildContentSecurityPolicy,
  isProductionCspMode,
} from "./lib/csp-policy";
import { isLoopbackOrigin, resolveAllowedApiOrigin } from "./lib/cors-policy";
import { applyApiCachePolicy, applyPageCachePolicy } from "./lib/edge-cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  generateCsrfToken,
  validateCsrfToken,
  CSRF_TOKEN_COOKIE,
} from "./lib/csrf";
import {
  HARDENED_SECURITY_HEADERS,
  checkMiddlewareFloodLimit,
  classifyClientBot,
  clientIpFromHeaders,
  isBlockedAttackPath,
  isSensitiveAuthSurface,
} from "./lib/request-security";
import {
  isAllowedEdgeHost,
  isDisallowedEdgeMethod,
  isEdgeContentLengthAllowed,
  isOnStaticIpBlocklist,
} from "./lib/server-security-edge";
import {
  freeTierFloodLimits,
  isFreeTierMode,
  isProductionInvocationBlockedPath,
} from "./lib/free-tier-guard";
import { checkEdgeDistributedLimit } from "./lib/edge-distributed-limit";

const API_CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";
const DEFAULT_ALLOWED_HEADERS = "Authorization, Content-Type";
const ALLOWED_CORS_HEADERS = [
  "Authorization",
  "Content-Type",
  "Accept",
  "Origin",
  "X-Requested-With",
  "X-CSRF-Token",
  "X-Client-Info",
].join(", ");

export async function proxy(request: NextRequest) {
  const pathname = normalizeLegacyDashboardPath(request.nextUrl.pathname);
  const ip = clientIpFromHeaders(request.headers);

  // ── Data-center edge gate (host / method / size / IP) ────────────────────
  if (isDisallowedEdgeMethod(request.method)) {
    const denied = new NextResponse(null, { status: 405 });
    applySecurityHeaders(denied, request);
    return denied;
  }

  const hostHeader =
    request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!isAllowedEdgeHost(hostHeader)) {
    const denied = NextResponse.json({ error: "Invalid host" }, { status: 421 });
    applySecurityHeaders(denied, request);
    return denied;
  }

  if (!isEdgeContentLengthAllowed(request.headers.get("content-length"), pathname)) {
    const denied = NextResponse.json(
      { error: "Payload too large" },
      { status: 413 },
    );
    applySecurityHeaders(denied, request);
    return denied;
  }

  if (isOnStaticIpBlocklist(ip)) {
    const denied = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    applySecurityHeaders(denied, request);
    return denied;
  }

  // Distributed temporary bans (Redis) - fail open if Redis is unreachable.
  try {
    const { getIpBanRemainingSec } = await import("./lib/ip-reputation");
    const bannedFor = await getIpBanRemainingSec(ip);
    if (bannedFor > 0) {
      const denied = NextResponse.json(
        { error: "Temporarily blocked due to abusive traffic." },
        {
          status: 403,
          headers: { "Retry-After": String(bannedFor) },
        },
      );
      applySecurityHeaders(denied, request);
      return denied;
    }
  } catch {
    // Never take the site down if reputation store fails.
  }

  // Drop common scanner / exploit probes before any session or DB work.
  if (isBlockedAttackPath(pathname)) {
    void import("./lib/ip-reputation")
      .then(({ recordIpAbuse }) => recordIpAbuse(ip, "attack_path"))
      .catch(() => {});
    const blocked = new NextResponse(null, { status: 404 });
    applySecurityHeaders(blocked, request);
    return blocked;
  }

  // Never pay a serverless invocation for debug/test routes in production.
  if (isProductionInvocationBlockedPath(pathname)) {
    const blocked = new NextResponse(null, { status: 404 });
    applySecurityHeaders(blocked, request);
    return blocked;
  }

  // Bot / AI scraper / automation gate - site-wide (not only login).
  // Blocks curl/python/scrapers and AI training agents from harvesting UI/API.
  // Official mobile (ZamSchoolOS-Mobile UA or authenticated okhttp) is allowed.
  const bot = classifyClientBot({
    userAgent: request.headers.get("user-agent"),
    pathname,
    method: request.method,
    authorization: request.headers.get("authorization"),
  });
  if (bot.block) {
    void import("./lib/ip-reputation")
      .then(({ recordIpAbuse }) => recordIpAbuse(ip, "bot_block"))
      .catch(() => {});
    const denied = NextResponse.json(
      { error: "Request blocked" },
      { status: 403 },
    );
    applySecurityHeaders(denied, request);
    applyRobotHeaders(denied, pathname);
    return denied;
  }

  // Edge flood guards:
  //   L1 — per-isolate memory (cheap; stops single-instance scrapers)
  //   L2 — Upstash fixed-window (free tier only; stops multi-isolate fan-out
  //        that would burn Vercel Hobby + Supabase free quotas)
  {
    const floodLimits = freeTierFloodLimits();
    const surface = isSensitiveAuthSurface(pathname)
      ? "auth"
      : pathname.startsWith("/api/")
        ? "api"
        : "page";
    const surfaceLimit =
      surface === "auth"
        ? floodLimits.auth
        : surface === "api"
          ? floodLimits.api
          : floodLimits.page;
    const memLimit = bot.suspicious
      ? surfaceLimit.suspicious
      : surfaceLimit.normal;

    const flood = checkMiddlewareFloodLimit({
      key: `${surface}-edge:${ip}`,
      limit: memLimit,
      windowMs: floodLimits.windowMs,
    });
    if (!flood.allowed) {
      void import("./lib/ip-reputation")
        .then(({ recordIpAbuse }) =>
          recordIpAbuse(ip, `${surface}_flood`),
        )
        .catch(() => {});
      const limited = NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(flood.retryAfterSec) },
        },
      );
      applySecurityHeaders(limited, request);
      return limited;
    }

    // Distributed free-tier shield (Redis). Skip health probes — monitors poll often.
    const isHealthProbe =
      pathname === "/api/health" || pathname === "/api/health/ready";
    if (isFreeTierMode() && !isHealthProbe) {
      const distributed = await checkEdgeDistributedLimit({
        ip,
        surface,
        suspicious: bot.suspicious,
      });
      if (!distributed.allowed) {
        void import("./lib/ip-reputation")
          .then(({ recordIpAbuse }) =>
            recordIpAbuse(
              ip,
              distributed.reason === "daily"
                ? "api_daily_cap"
                : `${surface}_dist_flood`,
            ),
          )
          .catch(() => {});
        const limited = NextResponse.json(
          {
            error:
              distributed.reason === "daily"
                ? "Daily request budget exceeded. Please try again tomorrow."
                : "Too many requests. Please try again shortly.",
            code:
              distributed.reason === "daily"
                ? "DAILY_EDGE_LIMIT"
                : "EDGE_RATE_LIMIT",
          },
          {
            status: 429,
            headers: { "Retry-After": String(distributed.retryAfterSec) },
          },
        );
        applySecurityHeaders(limited, request);
        return limited;
      }
    }
  }

  // RSC prefetch requests (_rsc=…) are speculative: the browser fires them when
  // the user hovers a <Link>, then aborts the request on the next navigation.
  // Running the full session/CORS/security pipeline on a cancelled prefetch
  // produces noisy `net::ERR_ABORTED` entries in the console. Serve them as a
  // plain pass-through so they short-circuit cleanly when aborted.
  const isRscPrefetch = request.nextUrl.searchParams.has("_rsc");
  if (isRscPrefetch) {
    return NextResponse.next({ request });
  }

  if (pathname.startsWith("/api/")) {
    const corsHeaders = buildApiCorsHeaders(request);

    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
      applySecurityHeaders(response, request);
      return response;
    }

    // Validate CSRF token for mutating requests on protected API routes
    // Skip public auth endpoints that are called before a CSRF cookie is established
    const publicAuthPrefixes = [
      "/api/auth/send-otp",
      "/api/auth/verify-otp",
      "/api/auth/register-school",
      "/api/auth/verify-access-code",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/auth/complete-first-login",
      // Pre-auth login lockout (Redis) - called before session exists; still rate-limited.
      "/api/auth/login-guard",
      "/api/staff/invitations/accept",
      "/api/auth/mfa",
    ];
    const isPublicAuthEndpoint = publicAuthPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    const mutatingMethods = ["POST", "PUT", "PATCH", "DELETE"];
    if (mutatingMethods.includes(request.method) && !isPublicAuthEndpoint) {
      // Cookie double-submit CSRF is for same-origin browser sessions.
      // Gateway mutations use Authorization: Bearer only (credentials: omit),
      // so the browser never sends the csrf-token cookie to the Worker and the
      // Worker cannot forward it. JWT bearer already authenticates the caller;
      // requiring CSRF here breaks all gateway POSTs (e.g. teacher roll call).
      const authHeader =
        request.headers.get("authorization") ||
        request.headers.get("Authorization") ||
        "";
      const hasBearer =
        /^Bearer\s+\S+/i.test(authHeader.trim()) &&
        authHeader.trim().length > "Bearer ".length + 10;

      if (!hasBearer) {
        const csrfTokenFromCookie =
          request.cookies.get(CSRF_TOKEN_COOKIE)?.value || null;
        const csrfTokenFromHeader =
          request.headers.get("x-csrf-token") || null;
        if (!validateCsrfToken(csrfTokenFromHeader, csrfTokenFromCookie)) {
          console.warn(
            "[CSRF] Validation failed for",
            request.method,
            pathname,
            "| cookie present:",
            Boolean(csrfTokenFromCookie),
            "| header present:",
            Boolean(csrfTokenFromHeader),
            "| tokens match:",
            csrfTokenFromCookie === csrfTokenFromHeader,
          );
          const response = NextResponse.json(
            { error: "Invalid CSRF token" },
            { status: 403, headers: corsHeaders },
          );
          applySecurityHeaders(response, request);
          return response;
        }
      }
    }

    const response = NextResponse.next();
    applyCorsHeaders(response, corsHeaders);
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    applyApiCachePolicy(pathname, request.method, response);
    return response;
  }

  let response = NextResponse.next({ request });

  // Ensure CSRF cookie is set on every response, including redirects
  ensureCsrfCookie(response, request);

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/verify-email") ||
    pathname.startsWith("/accept-invitation") ||
    pathname.startsWith("/join");
  const isFirstLoginPage = pathname.startsWith("/first-login");
  const isDashboardPage =
    isFirstLoginPage ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/teacher") ||
    pathname.startsWith("/student") ||
    pathname.startsWith("/parent") ||
    pathname.startsWith("/super-admin") ||
    pathname.startsWith("/payments");
  const isMfaChallengePage = pathname.startsWith("/login/mfa");
  const needsVerifiedSession =
    isDashboardPage || isAuthPage || isMfaChallengePage;

  let verified = null;
  if (needsVerifiedSession) {
    verified = await resolveVerifiedMiddlewareSession(request, response);
  }

  const hasSession = Boolean(verified?.userId);
  const role = verified?.role ?? null;
  const mustChangePassword = verified?.mustChangePassword ?? false;

  if (!hasSession && isDashboardPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "redirectTo",
      `${pathname}${request.nextUrl.search}`,
    );
    response = NextResponse.redirect(loginUrl);
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    return response;
  }

  if (hasSession && pathname !== request.nextUrl.pathname) {
    response = NextResponse.redirect(
      new URL(`${pathname}${request.nextUrl.search}`, request.url),
    );
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    return response;
  }

  const canonicalRolePath = resolveRoleAwareProtectedPath(role, pathname);
  if (hasSession && canonicalRolePath !== pathname) {
    response = NextResponse.redirect(
      new URL(`${canonicalRolePath}${request.nextUrl.search}`, request.url),
    );
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    return response;
  }

  if (
    hasSession &&
    mustChangePassword &&
    isDashboardPage &&
    !isFirstLoginPage
  ) {
    response = NextResponse.redirect(new URL("/first-login", request.url));
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    return response;
  }

  if (hasSession && isDashboardPage && role && !canAccessPath(role, pathname)) {
    const homePath = resolvePostLoginPath(role, pathname);
    // Avoid redirect loops when home itself was misclassified (e.g. student
    // hitting /app/student while canAccessPath only allowed legacy /student).
    if (homePath !== pathname) {
      response = NextResponse.redirect(
        new URL(`${homePath}${request.nextUrl.search}`, request.url),
      );
      ensureCsrfCookie(response, request);
      applySecurityHeaders(response, request);
      return response;
    }
  }

  if (hasSession && isAuthPage) {
    if (pathname.startsWith("/login")) {
      applySecurityHeaders(response, request);
      return response;
    }
    if (pathname.startsWith("/reset-password")) {
      applySecurityHeaders(response, request);
      return response;
    }

    if (
      !role &&
      (pathname.startsWith("/register") || pathname.startsWith("/verify-email"))
    ) {
      applySecurityHeaders(response, request);
      return response;
    }

    response = NextResponse.redirect(
      new URL(resolvePostLoginPath(role), request.url),
    );
    ensureCsrfCookie(response, request);
    applySecurityHeaders(response, request);
    return response;
  }

  if (hasSession && isDashboardPage && !isMfaChallengePage && verified) {
    if (verified.aal === "aal1" && verified.mfaEnrolled) {
      const mfaUrl = new URL("/login/mfa", request.url);
      mfaUrl.searchParams.set(
        "returnTo",
        `${pathname}${request.nextUrl.search}`,
      );
      response = NextResponse.redirect(mfaUrl);
      ensureCsrfCookie(response, request);
      applySecurityHeaders(response, request);
      return response;
    }
  }

  applySecurityHeaders(response, request);
  applyPageCachePolicy(pathname, response);
  return response;
}

function buildApiCorsHeaders(request: NextRequest) {
  const headers = new Headers();
  const allowedOrigin = resolveAllowedApiOriginFromRequest(request);

  if (!allowedOrigin) {
    return headers;
  }

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", API_CORS_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_CORS_HEADERS);
  headers.set("Vary", "Origin, Access-Control-Request-Headers");

  return headers;
}

function applyCorsHeaders(response: NextResponse, headers: Headers) {
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });
}

function applyRobotHeaders(response: NextResponse, pathname: string) {
  const path = (pathname.split("?")[0] || pathname).toLowerCase();
  const isPublicIndexable =
    path === "/" ||
    path === "/privacy" ||
    path === "/terms" ||
    path === "/cookies" ||
    path === "/sitemap.xml" ||
    path === "/robots.txt" ||
    path === "/icon.png" ||
    path.startsWith("/_next/static/") ||
    path.startsWith("/.well-known/");

  if (isPublicIndexable) {
    // Search engines may index marketing pages; AI training scrapers are told no.
    response.headers.set("X-Robots-Tag", "noai, noimageai");
    return;
  }

  // Login, app workspaces, APIs - never index, never train on.
  response.headers.set(
    "X-Robots-Tag",
    "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai",
  );
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:" ||
    request.nextUrl.hostname.endsWith(".vercel.app");

  Object.entries(HARDENED_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy({
      isProduction: isProductionCspMode(),
      shouldUpgradeInsecureRequests:
        isHttps && !isLoopbackOrigin(request.nextUrl.origin),
    }),
  );

  if (isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Never advertise server tech stacks on responses we control.
  response.headers.delete("X-Powered-By");
  response.headers.delete("Server");

  // Indexing + AI-training policy (enforced headers; robots.txt is also updated).
  applyRobotHeaders(response, request.nextUrl.pathname || "/");

  // Cache-control for auth HTML already set elsewhere; reinforce no-store for cookies.
  if (!response.headers.has("X-Content-Type-Options")) {
    response.headers.set("X-Content-Type-Options", "nosniff");
  }
}

function resolveAllowedApiOriginFromRequest(request: NextRequest) {
  return resolveAllowedApiOrigin(request.headers.get("origin"));
}

/**
 * Always re-assert the CSRF cookie as JS-readable (httpOnly: false).
 * Older sessions may still hold an HttpOnly csrf-token cookie; middleware can
 * see it while document.cookie cannot, so mutations omit the header and get 403.
 * Re-setting the same name overwrites attributes in the browser.
 */
function ensureCsrfCookie(response: NextResponse, request: NextRequest) {
  const existing = request.cookies.get(CSRF_TOKEN_COOKIE)?.value?.trim();
  const token = existing || generateCsrfToken();
  const isHttps =
    request.headers.get("x-forwarded-proto") === "https" ||
    request.nextUrl.protocol === "https:" ||
    request.nextUrl.hostname.endsWith(".vercel.app");

  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: false,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  // Clients capture this when document.cookie is empty/stale.
  response.headers.set("X-CSRF-Token", token);
  const exposed = response.headers.get("Access-Control-Expose-Headers");
  if (!exposed) {
    response.headers.set("Access-Control-Expose-Headers", "X-CSRF-Token");
  } else if (!/x-csrf-token/i.test(exposed)) {
    response.headers.set(
      "Access-Control-Expose-Headers",
      `${exposed}, X-CSRF-Token`,
    );
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    /*
     * Skip SW + offline shell so phones always get them without middleware
     * work (critical when CSS/cache issues are already present).
     */
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
