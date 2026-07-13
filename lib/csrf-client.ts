import { CSRF_TOKEN_COOKIE } from "@/lib/csrf";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const MEMORY_KEY = "zamschool_csrf_token";

/** In-memory fallback when document.cookie is empty/stale (e.g. race after login). */
let memoryToken: string | null = null;

function readMemoryToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof sessionStorage === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(MEMORY_KEY);
    return stored && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Remember a CSRF token from a response header or successful bootstrap so
 * mutations work even if document.cookie is briefly unavailable.
 */
export function rememberCsrfToken(token: string | null | undefined): void {
  const value = String(token || "").trim();
  if (!value) return;
  memoryToken = value;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem(MEMORY_KEY, value);
    } catch {
      // ignore quota / private mode
    }
  }
}

export function clearRememberedCsrfToken(): void {
  memoryToken = null;
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.removeItem(MEMORY_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Read the double-submit CSRF token from document.cookie.
 * The cookie must be readable by JavaScript (httpOnly: false).
 */
export function readCsrfTokenFromDocument(): string | null {
  if (typeof document === "undefined") return null;

  const raw = document.cookie;
  if (!raw) return null;

  for (const pair of raw.split(";")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const name = trimmed.substring(0, idx).trim();
    if (name !== CSRF_TOKEN_COOKIE) continue;

    const value = trimmed.substring(idx + 1).trim();
    if (!value) return null;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

/** Best available CSRF token: cookie first, then remembered header/bootstrap. */
export function readCsrfToken(): string | null {
  return readCsrfTokenFromDocument() || readMemoryToken();
}

export function applyCsrfHeader(
  headers: Headers,
  method: string,
): string | null {
  if (!MUTATING_METHODS.has(String(method || "GET").toUpperCase())) {
    return null;
  }

  const csrf = readCsrfToken();
  if (csrf) {
    headers.set("X-CSRF-Token", csrf);
  }
  return csrf;
}

export function requireCsrfTokenForMutation(method: string): string {
  const normalized = String(method || "GET").toUpperCase();
  if (!MUTATING_METHODS.has(normalized)) {
    return "";
  }

  const csrf = readCsrfToken();
  if (!csrf) {
    throw new Error(
      "Missing CSRF token. Refresh the page, then try again.",
    );
  }

  return csrf;
}

/**
 * Capture X-CSRF-Token from a Response (middleware echoes it on every API response).
 */
export function captureCsrfFromResponse(response: Response | null | undefined): void {
  if (!response) return;
  const header =
    response.headers.get("X-CSRF-Token") ||
    response.headers.get("x-csrf-token");
  if (header) rememberCsrfToken(header);
}

/**
 * Ensure a CSRF token is available before a mutation.
 * Hits a cheap authenticated GET to mint/refresh the readable cookie if needed.
 */
export async function ensureCsrfTokenAvailable(
  bootstrapUrl = "/api/account/csrf",
): Promise<string> {
  const existing = readCsrfToken();
  if (existing) return existing;

  try {
    const response = await fetch(bootstrapUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    captureCsrfFromResponse(response);
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        data?: { csrfToken?: string };
        csrfToken?: string;
      } | null;
      const fromBody =
        body?.data?.csrfToken || body?.csrfToken || null;
      if (fromBody) rememberCsrfToken(fromBody);
    }
  } catch {
    // fall through
  }

  const token = readCsrfToken();
  if (!token) {
    throw new Error(
      "Missing CSRF token. Refresh the page, then try again.",
    );
  }
  return token;
}

export function isCsrfFailureStatus(status: number, body?: unknown): boolean {
  if (status !== 403) return false;
  const error =
    body && typeof body === "object"
      ? String((body as { error?: string }).error || "")
      : "";
  return /csrf/i.test(error) || error === "Invalid CSRF token";
}
