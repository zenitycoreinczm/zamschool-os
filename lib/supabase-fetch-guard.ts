/**
 * Supabase Per-User Fetch Guard
 *
 * Replaces globalThis.fetch with a guarded version that:
 * 1. Intercepts ALL requests to *.supabase.co
 * 2. Enforces a 25 req/s per-user sliding-window budget
 * 3. Each device/user has their OWN independent budget
 * 4. Records telemetry via supabase-request-budget.ts
 * 5. Logs slow queries (>1s) for debugging
 *
 * Per-user budget means 100 concurrent users can each make 25 req/s
 * without affecting each other's budgets.
 *
 * Non-Supabase traffic (including Next.js RSC /_rsc flight requests) is
 * returned from the original fetch Promise with no extra async hop - wrapping
 * every call in `async` races AbortSignals and surfaces as
 * "Failed to fetch RSC payload".
 */
import {
  isSupabaseCircuitOpen,
  isSupabaseNetworkError,
  openSupabaseCircuit,
  recordSupabaseNetworkSuccess,
  resetSupabaseConnectivityState,
} from "./supabase-connectivity";
import { recordRequest } from "./supabase-request-budget";

// ─── Constants ──────────────────────────────────────────────────────────────

const SUPABASE_HOST_PATTERN = /\.supabase\.co/i;
const MAX_REQUESTS_PER_SECOND_PER_USER = 25;
const WINDOW_MS = 1000;
const SLOW_QUERY_THRESHOLD_MS = 1_000;
const DEVICE_ID_KEY = "zamschool_device_id";

// ─── State ──────────────────────────────────────────────────────────────────

let guardInstalled = false;
let originalFetch: typeof globalThis.fetch | null = null;

/** Per-device request tracking: deviceId → timestamps[] */
const perDeviceTimestamps = new Map<string, number[]>();

// ─── Device identification ─────────────────────────────────────────────────

/**
 * Stable fallback ID when localStorage is unavailable (e.g. incognito mode,
 * cookies disabled, or private browsing). Without this singleton, every call
 * to getDeviceId() would generate a fresh random ID, which silently resets
 * the per-device rate-limit budget and defeats the guard entirely.
 */
let fallbackDeviceId: string | null = null;

/**
 * Get or create a unique device identifier.
 * This ensures each phone/browser has its own rate limit budget.
 */
function getDeviceId(): string {
  if (typeof window === "undefined") {
    // Server-side: one stable bucket per process so the budget actually
    // tracks the rate. A per-call id (pid+Date.now()) resets the window
    // every request and silently disables the guard.
    return `server-${process.pid}`;
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      // Generate a unique ID for this device
      deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    // Fallback if localStorage is unavailable - use a module-level singleton
    // so the same ID persists for the lifetime of this page/tab.
    if (!fallbackDeviceId) {
      fallbackDeviceId = `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
    return fallbackDeviceId;
  }
}

// ─── Budget helpers ─────────────────────────────────────────────────────────

function getDeviceTimestamps(deviceId: string): number[] {
  if (!perDeviceTimestamps.has(deviceId)) {
    perDeviceTimestamps.set(deviceId, []);
  }
  return perDeviceTimestamps.get(deviceId)!;
}

function pruneWindow(deviceId: string): void {
  const timestamps = getDeviceTimestamps(deviceId);
  const cutoff = Date.now() - WINDOW_MS;
  let i = 0;
  while (i < timestamps.length && timestamps[i] < cutoff) {
    i++;
  }
  if (i > 0) timestamps.splice(0, i);
}

function currentRate(deviceId: string): number {
  pruneWindow(deviceId);
  return getDeviceTimestamps(deviceId).length;
}

function recordLocalBudget(deviceId: string): void {
  pruneWindow(deviceId);
  getDeviceTimestamps(deviceId).push(Date.now());
}

/**
 * Asynchronously wait until this device's budget allows another request.
 * Uses setTimeout-based polling so the event loop is not blocked.
 */
async function waitForBudget(deviceId: string): Promise<void> {
  const maxWaitMs = 5_000;
  const started = Date.now();

  while (currentRate(deviceId) >= MAX_REQUESTS_PER_SECOND_PER_USER) {
    if (Date.now() - started > maxWaitMs) {
      console.warn(
        `[SupabaseFetchGuard] Device ${deviceId.slice(0, 12)}... budget wait timed out.`
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// ─── Fetch guard ────────────────────────────────────────────────────────────

function createGuardedFetch(original: typeof globalThis.fetch): typeof globalThis.fetch {
  // NOTE: This outer function must NOT be `async`. For non-Supabase traffic we
  // return the exact Promise from `original` so Next.js RSC AbortSignals and
  // flight caching keep working. An async wrapper adds a microtask hop that
  // can lose the race and throw TypeError: Failed to fetch.
  function guardedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let url: string;
    try {
      url = resolveRequestUrl(input);
    } catch {
      return original.call(globalThis, input, init);
    }

    // Only intercept Supabase API calls
    if (!SUPABASE_HOST_PATTERN.test(url)) {
      return original.call(globalThis, input, init);
    }

    return (async () => {
      if (isSupabaseCircuitOpen()) {
        throw new TypeError(
          "fetch failed: Supabase temporarily unreachable (connectivity circuit open)",
        );
      }

      const deviceId = getDeviceId();

      // 1. Enforce per-device rate-limit budget
      await waitForBudget(deviceId);

      const startTime = performance.now();

      // 2. Forward the request
      try {
        const response = await original.call(globalThis, input, init);
        const duration = performance.now() - startTime;
        recordSupabaseNetworkSuccess();

        // 3. Record the request in this device's budget
        recordLocalBudget(deviceId);
        try {
          recordRequest();
        } catch {
          // Global budget recording is best-effort
        }

        // 4. Log slow Supabase calls
        if (duration > SLOW_QUERY_THRESHOLD_MS) {
          const ms = Math.round(duration);
          const shortUrl = url.slice(0, 200);
          const isAuthToken =
            /\/auth\/v1\/token/i.test(url) ||
            /\/auth\/v1\/(signup|verify|recover)/i.test(url);

          if (isAuthToken) {
            if (duration > 3_000) {
              console.warn(
                `[SupabaseFetchGuard] Slow auth request (${ms}ms): ${shortUrl}`,
              );
            }
          } else {
            console.warn(
              `[SupabaseFetchGuard] Slow query (${ms}ms): ${shortUrl}`,
            );
          }
        }

        return response;
      } catch (error) {
        // Still record the request even on failure
        recordLocalBudget(deviceId);
        try {
          recordRequest();
        } catch {
          // best-effort
        }

        // Aborted/cancelled requests are normal (hover prefetches, rapid nav).
        // Do not treat them as connectivity failures.
        const aborted =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");

        if (!aborted && isSupabaseNetworkError(error)) {
          openSupabaseCircuit(error);
        } else if (!aborted) {
          console.error(
            `[SupabaseFetchGuard] Request failed: ${url.slice(0, 200)} - ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        throw error;
      }
    })();
  }

  return guardedFetch as typeof globalThis.fetch;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Install the global fetch interceptor.
 *
 * Safe to call multiple times - subsequent calls are no-ops.
 * Call from instrumentation.ts (server) and SupabaseGuardBootstrap.tsx (client).
 */
export function installSupabaseFetchGuard(): void {
  if (guardInstalled) return;

  if (typeof globalThis === "undefined") {
    console.warn(
      "[SupabaseFetchGuard] globalThis not available - skipping guard install.",
    );
    return;
  }

  // Avoid double-wrapping if HMR re-runs install without clearing the flag.
  const current = globalThis.fetch as typeof globalThis.fetch & {
    __originalFetch?: typeof globalThis.fetch;
  };
  originalFetch = current.__originalFetch || current;
  const guardedFetch = createGuardedFetch(originalFetch);

  // Store original fetch for uninstall
  (guardedFetch as typeof guardedFetch & { __originalFetch?: typeof globalThis.fetch }).__originalFetch =
    originalFetch;

  globalThis.fetch = guardedFetch;
  guardInstalled = true;

  if (typeof window !== "undefined") {
    console.debug("[SupabaseFetchGuard] Client-side fetch guard installed.");
  }
}

/**
 * Uninstall the global fetch interceptor, restoring the original fetch.
 */
export function uninstallSupabaseFetchGuard(): void {
  if (!guardInstalled || !originalFetch) {
    console.warn(
      "[SupabaseFetchGuard] Guard not installed - nothing to uninstall.",
    );
    return;
  }

  globalThis.fetch = originalFetch;
  guardInstalled = false;
}

/**
 * Check whether the fetch guard is currently installed.
 */
export function isGuardInstalled(): boolean {
  return guardInstalled;
}

/**
 * Get current telemetry from the guard's per-device budget.
 */
export function getFetchGuardTelemetry(): {
  currentRps: number;
  maxRps: number;
  installed: boolean;
  activeDevices: number;
} {
  const deviceId = getDeviceId();
  return {
    currentRps: currentRate(deviceId),
    maxRps: MAX_REQUESTS_PER_SECOND_PER_USER,
    installed: guardInstalled,
    activeDevices: perDeviceTimestamps.size,
  };
}

/**
 * Reset guard state (useful for testing).
 */
export function resetFetchGuard(): void {
  perDeviceTimestamps.clear();
  fallbackDeviceId = null;
  resetSupabaseConnectivityState();
}

// ─── Helper for createCallingComponent that also installs guard ─────────────

export const guardSetupToken = Symbol("supabaseFetchGuardInstalled");
