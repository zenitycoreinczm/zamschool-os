/**
 * Cloudflare Gateway client (the only way clients talk to the API).
 *
 * When `NEXT_PUBLIC_GATEWAY_URL` is set the browser POSTs everything through
 * `workers/gateway/` (JWT verify → KV rate-limit → edge cache → proxy → R2).
 * When it is unset (local dev, preview branches not yet cut over) we fall
 * through to the same-origin /api/* routes so the app keeps working.
 *
 * Use `fetchGatewayRead` for safe reads, `fetchGatewayMutation` for writes,
 * and `uploadViaGateway` for direct-to-R2 uploads.
 *
 * All three:
 *   - inject the Supabase bearer token (the Worker verifies it independently)
 *   - inject X-CSRF-Token from the cookie (the Vercel middleware enforces it)
 *   - respect `fallbackToLocal: true` so a Worker outage degrades to direct
 *     /api/* instead of 5xx-ing the user
 *   - return the underlying Response so callers can stream / cache as usual
 */
import {
  captureCsrfFromResponse,
  ensureCsrfTokenAvailable,
  readCsrfToken,
  rememberCsrfToken,
} from "@/lib/csrf-client";
import { supabase } from "@/lib/supabase";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";

const GATEWAY_URL = String(process.env.NEXT_PUBLIC_GATEWAY_URL || "").trim();
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type GatewayOptions = RequestInit & {
  /**
   * Fall back to the same-origin /api/* path on 404 / 5xx or on a
   * network error. Defaults to TRUE — meant to keep dev/preview working
   * even if the gateway URL is wrong, dead, or not yet deployed.
   */
  fallbackToLocal?: boolean;
  /**
   * Direct call, e.g. for uploads that always go to /api/upload (a Worker
   * native route). When set, the path is appended to the gateway URL and
   * CSRF is NOT injected (Worker authorizes via JWT only).
   */
  bypassCsrf?: boolean;
};

function isBrowser() {
  return typeof window !== "undefined";
}

async function buildHeaders(
  init: RequestInit,
  method: string,
  bypassCsrf: boolean,
): Promise<Headers> {
  const headers = new Headers(init.headers || {});
  // The Worker doesn't need Content-Type: application/json baked in — it just
  // forwards body bytes. We still set it for the same-origin fallback so
  // Next.js route handlers can parse JSON correctly.
  if (
    !headers.has("Content-Type") &&
    init.body &&
    typeof init.body === "string" &&
    method !== "GET"
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (!bypassCsrf && MUTATING.has(method.toUpperCase()) && isBrowser()) {
    // Always inject a real token — never soft-skip (that caused registrar 403s).
    const csrf = await ensureCsrfTokenAvailable();
    headers.set("X-CSRF-Token", csrf);
    rememberCsrfToken(csrf);
  }
  return headers;
}

async function buildGatewayUrl(path: string): Promise<string | null> {
  if (!GATEWAY_URL || !path.startsWith("/")) return null;
  return new URL(path.slice(1), ensureTrailingSlash(GATEWAY_URL)).toString();
}

function shouldFallback(status: number) {
  return status === 404 || status >= 500;
}

function shouldAddAuthorization(init: RequestInit): boolean {
  const headers = new Headers(init.headers || {});
  return !headers.has("authorization") && !headers.has("Authorization");
}

async function getAccessToken(): Promise<string | null> {
  if (!isBrowser()) return null;
  // supabase.auth.getSession() reads from localStorage and is cheap.
  const sessionResult = await supabase.auth.getSession();
  return sessionResult?.data?.session?.access_token ?? null;
}

async function gatewayFetchImpl(
  path: string,
  init: GatewayOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const fallbackToLocal = init.fallbackToLocal !== false;
  const bypassCsrf = init.bypassCsrf === true;
  const method = String(init.method || "GET").toUpperCase();
  const localUrl = String(path || "").trim();
  const headers = await buildHeaders(init, method, bypassCsrf);

  // Same-origin only — same gateway helper used everywhere.
  // We strip any Authorization header before forwarding to same-origin routes
  // to ensure cookie-backed authentication is strictly utilized.
  const localFetch = async () => {
    const cleanHeaders = new Headers(headers);
    cleanHeaders.delete("authorization");
    cleanHeaders.delete("Authorization");
    // Re-assert CSRF for local fallback (cookie path requires header).
    if (!bypassCsrf && MUTATING.has(method) && isBrowser()) {
      const csrf = readCsrfToken() || (await ensureCsrfTokenAvailable());
      cleanHeaders.set("X-CSRF-Token", csrf);
    }
    const response = await fetchWithOfflineSupport(localUrl, {
      ...init,
      headers: cleanHeaders,
      credentials: "include",
    });
    captureCsrfFromResponse(response);
    return response;
  };

  const gatewayUrl = await buildGatewayUrl(localUrl);

  // 1. No GATEWAY_URL configured → talk to /api/* directly.
  if (!gatewayUrl) {
    return localFetch();
  }

  // 2. No Supabase session → we can't pass the bearer token to the Worker.
  // Fall through to /api/* (which is cookie-based and still authenticated),
  // unless caller explicitly opted out.
  if (shouldAddAuthorization(init)) {
    const token = await getAccessToken();
    if (!token) {
      if (fallbackToLocal) return localFetch();
      return localFetch();
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  // 3. Try the gateway. On 404/5xx or network errors, fall back.
  try {
    const response = await fetchImpl(gatewayUrl, {
      ...init,
      headers,
      credentials: "omit",
    });
    captureCsrfFromResponse(response);
    if (!fallbackToLocal) return response;
    if (response.ok || !shouldFallback(response.status)) {
      return response;
    }
  } catch (err) {
    if (!fallbackToLocal) throw err;
  }

  return localFetch();
}

/** GET through the gateway (or same-origin /api/* fallback). */
export async function fetchGatewayRead(
  path: string,
  init: GatewayOptions = {},
): Promise<Response> {
  return gatewayFetchImpl(path, { ...init, method: init.method || "GET" });
}

/** Mutations (POST/PUT/PATCH/DELETE) through the gateway with CSRF + token. */
export async function fetchGatewayMutation(
  path: string,
  init: GatewayOptions = {},
): Promise<Response> {
  const method = String(init.method || "POST").toUpperCase();
  return gatewayFetchImpl(path, { ...init, method });
}

/**
 * Direct upload via the Worker's native /api/upload route.
 * The Worker:
 *   1. authorizes via Next.js /api/files/authorize-upload
 *   2. PUTs the byte stream straight into R2 (no Vercel function bandwidth)
 * Always uses the gateway path — never falls back to /api/* because the
 * /api/files/upload route on Vercel is the *very* thing we're moving bytes
 * off of. When the gateway URL is unset we throw a clear error so callers
 * can decide whether to fall back to the legacy /api/files/upload route.
 */
export async function uploadViaGateway(formData: FormData): Promise<Response> {
  if (!GATEWAY_URL) {
    throw new Error(
      "[uploadViaGateway] NEXT_PUBLIC_GATEWAY_URL is not configured; cannot upload via Worker. " +
        "Set NEXT_PUBLIC_GATEWAY_URL or call /api/files/upload directly.",
    );
  }
  const url = `${ensureTrailingSlash(GATEWAY_URL)}api/upload`;
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, {
    method: "POST",
    body: formData,
    credentials: "omit",
    headers,
  });
}

export function isGatewayConfigured(): boolean {
  return Boolean(GATEWAY_URL);
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
