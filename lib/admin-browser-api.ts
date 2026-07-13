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
import {
  humanizeFetchFailure,
  humanizeHttpError,
} from "@/lib/client-api-errors";
import { fetchWithOfflineSupport } from "@/lib/offline-fetch";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Inflight request deduplication for GET requests to same-origin /api/*.
 * Prevents duplicate parallel fetches for the same URL.
 */
const inflightGet = new Map<string, Promise<Response>>();

async function buildLocalHeaders(
  init: RequestInit,
  method: string,
): Promise<Headers> {
  const headers = new Headers(init.headers || {});
  if (
    !headers.has("Content-Type") &&
    init.body &&
    typeof init.body === "string" &&
    method !== "GET"
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (MUTATING.has(method.toUpperCase())) {
    // Ensure readable token (cookie re-assert / bootstrap) then always inject.
    const csrf = await ensureCsrfTokenAvailable();
    headers.set("X-CSRF-Token", csrf);
    rememberCsrfToken(csrf);
  }
  return headers;
}

/**
 * Single fetch entrypoint: prefers the Worker (when NEXT_PUBLIC_GATEWAY_URL
 * is set), falls through to the same-origin /api/* with CSRF + offline support.
 */
export async function adminApiFetch(input: string, init: RequestInit = {}) {
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

  // Local /api/* fallback.
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
  if (!MUTATING.has(method) || response.status !== 403) {
    return response;
  }

  // Peek body without consuming caller's clone
  const clone = response.clone();
  let body: unknown = null;
  try {
    body = await clone.json();
  } catch {
    body = null;
  }

  if (!isCsrfFailureStatus(response.status, body)) {
    return response;
  }

  // Force-refresh token then retry once.
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

export async function adminApiJson<T = any>(
  input: string,
  init: RequestInit = {},
) {
  let response: Response;
  try {
    response = await adminApiFetch(input, init);
  } catch (error) {
    const message = humanizeFetchFailure(error);
    const wrapped = new Error(message);
    // Preserve abort/timeout semantics so widgets can soft-fail without
    // noisy console errors (isAbortLikeError checks name + message).
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        /aborted|timeout|took too long/i.test(error.message) ||
        /took too long/i.test(message))
    ) {
      wrapped.name = "AbortError";
    }
    throw wrapped;
  }

  const parsedBody = await response.json().catch(() => null);
  const body =
    typeof parsedBody === "object" && parsedBody !== null ? parsedBody : {};

  if (!response.ok) {
    const serverMessage =
      typeof (body as { error?: unknown }).error === "string"
        ? (body as { error: string }).error
        : typeof (body as { message?: unknown }).message === "string"
          ? (body as { message: string }).message
          : null;
    throw new Error(humanizeHttpError(response.status, serverMessage));
  }

  return body as T;
}
