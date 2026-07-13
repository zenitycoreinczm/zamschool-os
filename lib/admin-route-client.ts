import {
  captureCsrfFromResponse,
  ensureCsrfTokenAvailable,
  isCsrfFailureStatus,
  readCsrfToken,
  rememberCsrfToken,
} from "@/lib/csrf-client";
import { fetchWithOfflineSupport } from "./offline-fetch.ts";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type AdminRouteRequestInit = RequestInit & {
  params?: Record<string, string | number | boolean | null | undefined>;
};

export async function parseAdminRouteResponse(response: Response) {
  let payload: any = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        (payload.error || payload.message)) ||
      "Request failed";
    throw new Error(String(message));
  }

  return payload;
}

export async function adminRequest(
  path: string,
  init: AdminRouteRequestInit = {},
) {
  const url = new URL(path, globalThis.location?.origin || "http://localhost");
  const headers = new Headers(init.headers);

  if (init.params) {
    for (const [key, value] of Object.entries(init.params)) {
      if (value === null || value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const method = String(init.method || "GET").toUpperCase();
  if (MUTATING_METHODS.has(method)) {
    const csrf = await ensureCsrfTokenAvailable();
    headers.set("X-CSRF-Token", csrf);
    rememberCsrfToken(csrf);
  }

  let response = await fetchWithOfflineSupport(url.toString(), {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    credentials: init.credentials ?? "include",
  });
  captureCsrfFromResponse(response);

  // One retry after CSRF bootstrap if the cookie was HttpOnly/stale.
  if (MUTATING_METHODS.has(method) && response.status === 403) {
    const clone = response.clone();
    let body: unknown = null;
    try {
      body = await clone.json();
    } catch {
      body = null;
    }
    if (isCsrfFailureStatus(response.status, body)) {
      try {
        await ensureCsrfTokenAvailable();
        const retryHeaders = new Headers(headers);
        const csrf = readCsrfToken();
        if (csrf) {
          retryHeaders.set("X-CSRF-Token", csrf);
          response = await fetchWithOfflineSupport(url.toString(), {
            ...init,
            headers: retryHeaders,
            cache: "no-store",
            credentials: "include",
          });
          captureCsrfFromResponse(response);
        }
      } catch {
        // fall through to parseAdminRouteResponse error
      }
    }
  }

  return parseAdminRouteResponse(response);
}

export function adminGet(
  path: string,
  init: Omit<AdminRouteRequestInit, "method"> = {},
) {
  return adminRequest(path, { ...init, method: "GET" });
}

export function adminPost<TBody>(
  path: string,
  body: TBody,
  init: Omit<AdminRouteRequestInit, "method" | "body"> = {},
) {
  return adminRequest(path, {
    ...init,
    method: "POST",
    headers: jsonHeaders(init.headers),
    body: JSON.stringify(body),
  });
}

export function adminDelete(
  path: string,
  init: Omit<AdminRouteRequestInit, "method"> = {},
) {
  return adminRequest(path, { ...init, method: "DELETE" });
}

export function buildFinanceMutationPayload(form: {
  type: string;
  category: string;
  amount: string | number;
  description: string;
  transaction_date: string;
}) {
  return {
    transactionType: String(form.type || "income"),
    category: normalizeOptionalString(form.category),
    amount: normalizeAmount(form.amount),
    description: normalizeOptionalString(form.description),
    transactionDate:
      form.transaction_date || new Date().toISOString().slice(0, 10),
  };
}

function jsonHeaders(existingHeaders?: HeadersInit) {
  const headers = new Headers(existingHeaders);
  headers.set("Content-Type", "application/json");
  return headers;
}

function normalizeOptionalString(value: string) {
  const text = String(value || "").trim();
  return text || undefined;
}

function normalizeAmount(value: string | number) {
  if (typeof value === "number") return value;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}
