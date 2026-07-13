"use client";

import {
  captureCsrfFromResponse,
  ensureCsrfTokenAvailable,
  isCsrfFailureStatus,
  readCsrfToken,
  rememberCsrfToken,
} from "@/lib/csrf-client";
import {
  fetchGatewayRead,
  fetchGatewayMutation,
  isGatewayConfigured,
} from "@/lib/gateway-read-client";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Inflight request deduplication for GET requests to same-origin /api/*.
 */
const inflightGet = new Map<string, Promise<Response>>();

async function buildLocalHeaders(
  init: RequestInit,
  method: string,
): Promise<Headers> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (MUTATING.has(method.toUpperCase())) {
    const csrf = await ensureCsrfTokenAvailable();
    headers.set("X-CSRF-Token", csrf);
    rememberCsrfToken(csrf);
  }
  return headers;
}

export async function accountApiFetch(input: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase();

  if (isGatewayConfigured()) {
    if (method === "GET" || method === "HEAD") {
      const response = await fetchGatewayRead(input, {
        ...init,
        cache: init.cache ?? "default",
      });
      captureCsrfFromResponse(response);
      return response;
    }
    const response = await fetchGatewayMutation(input, init);
    captureCsrfFromResponse(response);
    return maybeRetryCsrf(input, init, response, true);
  }

  const headers = await buildLocalHeaders(init, method);

  if (method !== "GET" && method !== "HEAD") {
    const response = await fetchWithOfflineSupport(input, {
      ...init,
      headers,
      cache: init.cache ?? "no-store",
      credentials: "include",
    });
    captureCsrfFromResponse(response);
    return maybeRetryCsrf(input, init, response, false);
  }

  const existing = inflightGet.get(input);
  if (existing) return existing;

  const promise = fetchWithOfflineSupport(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
    credentials: "include",
  })
    .then((response) => {
      captureCsrfFromResponse(response);
      return response;
    })
    .finally(() => {
      inflightGet.delete(input);
    });

  inflightGet.set(input, promise);
  return promise;
}

async function maybeRetryCsrf(
  input: string,
  init: RequestInit,
  response: Response,
  viaGateway: boolean,
): Promise<Response> {
  const method = String(init.method || "GET").toUpperCase();
  if (!MUTATING.has(method) || response.status !== 403) return response;

  const clone = response.clone();
  let body: unknown = null;
  try {
    body = await clone.json();
  } catch {
    body = null;
  }
  if (!isCsrfFailureStatus(response.status, body)) return response;

  try {
    await ensureCsrfTokenAvailable();
  } catch {
    return response;
  }

  const headers = new Headers(init.headers || {});
  const csrf = readCsrfToken();
  if (!csrf) return response;
  headers.set("X-CSRF-Token", csrf);

  if (viaGateway) {
    const retry = await fetchGatewayMutation(input, { ...init, headers });
    captureCsrfFromResponse(retry);
    return retry;
  }

  const retry = await fetchWithOfflineSupport(input, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "include",
  });
  captureCsrfFromResponse(retry);
  return retry;
}

export async function accountApiJson<T = unknown>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await accountApiFetch(input, init);
  const parsedBody = await response.json().catch(() => null);
  const body =
    typeof parsedBody === "object" && parsedBody !== null ? parsedBody : {};

  if (!response.ok) {
    throw new Error(
      (body as { error?: string })?.error ||
        response.statusText ||
        `Request failed with status ${response.status}`,
    );
  }

  return body as T;
}
