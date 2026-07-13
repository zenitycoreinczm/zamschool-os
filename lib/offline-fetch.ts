import {
  OFFLINE_FETCH_ERROR_MESSAGE,
} from "./offline-support.ts";
import { networkStatusStore } from "./network-status.ts";
import { isRetriableNetworkError } from "./client-api-errors.ts";

type OfflineAwareFetchOptions = {
  fetchImpl?: typeof fetch;
  getBrowserOnline?: () => boolean;
  store?: typeof networkStatusStore;
  now?: () => number;
  /** Abort if the request takes longer than this (ms). Default 25s. */
  timeoutMs?: number;
  /** Retry GET once on transient network failure. Default true for GET. */
  retryGet?: boolean;
};

// Dashboard mounts many parallel /api calls; browser + Next cold compile can
// queue later widgets past 25s even when each handler is healthy.
const DEFAULT_TIMEOUT_MS = 35_000;
const GET_RETRY_DELAY_MS = 700;

export async function fetchWithOfflineSupport(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: OfflineAwareFetchOptions = {},
) {
  const fetchImpl = options.fetchImpl || fetch;
  const getBrowserOnline =
    options.getBrowserOnline ||
    (() =>
      typeof navigator === "undefined" ? true : navigator.onLine !== false);
  const store = options.store || networkStatusStore;
  const now = options.now || Date.now;
  const method = String(init.method || "GET").toUpperCase();
  const browserOnline = getBrowserOnline();
  const timeoutMs =
    typeof options.timeoutMs === "number"
      ? options.timeoutMs
      : DEFAULT_TIMEOUT_MS;
  const shouldRetryGet =
    options.retryGet !== false &&
    (method === "GET" || method === "HEAD") &&
    browserOnline;

  if (isMutationMethod(method) && !browserOnline) {
    store.setOffline();
    throw new Error(OFFLINE_FETCH_ERROR_MESSAGE);
  }

  const attempt = async () => {
    const startedAt = now();
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const externalSignal = init.signal;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (controller && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
    }

    if (externalSignal && controller) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), {
          once: true,
        });
      }
    }

    try {
      const response = await fetchImpl(input, {
        ...init,
        signal: controller?.signal ?? externalSignal,
      });
      const completedAt = now();

      if (!browserOnline) {
        store.setOffline();
        return response;
      }

      if (response.ok) {
        store.noteRequestSuccess({
          latencyMs: completedAt - startedAt,
          syncedAt: completedAt,
        });
      }

      return response;
    } catch (error) {
      if (timedOut) {
        const timeoutError = new Error(
          "The request took too long. On a slow connection, wait a moment and try again.",
        );
        timeoutError.name = "AbortError";
        throw timeoutError;
      }

      if (!getBrowserOnline()) {
        store.setOffline();
      }

      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  try {
    return await attempt();
  } catch (error) {
    if (shouldRetryGet && isRetriableNetworkError(error)) {
      await delay(GET_RETRY_DELAY_MS);
      if (!getBrowserOnline()) {
        store.setOffline();
        throw new Error(OFFLINE_FETCH_ERROR_MESSAGE);
      }
      return await attempt();
    }
    throw error;
  }
}

function isMutationMethod(method: string) {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
