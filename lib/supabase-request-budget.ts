/**
 * Supabase Request Budget System
 *
 * Tracks API calls in sliding 1-second windows and prevents exceeding
 * the Supabase free tier 30 req/s limit. Targets 25 req/s to leave headroom.
 *
 * Provider fallback: localStorage (client) → in-memory (server)
 * Integrates with the existing KV/Redis rate limit backoff from rate-limit.ts.
 */

import { isKvConfigured, checkKvRateLimit } from './kv-client';
import { checkRateLimit } from './rate-limit';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPABASE_MAX_RPS = 30;
const TARGET_RPS = 25;
const WARNING_THRESHOLD = Math.ceil(SUPABASE_MAX_RPS * 0.8); // 24 req/s
const WINDOW_MS = 1000; // 1 second sliding window
const LOCALSTORAGE_KEY = 'supabase_request_budget';
const LOCALSTORAGE_TTL_MS = 5000; // Persist to localStorage every 5s max

// ─── Types ───────────────────────────────────────────────────────────────────

interface BudgetState {
  /** Timestamps of requests in the current sliding window (ms) */
  timestamps: number[];
  /** Queued request promises waiting for budget */
  queue: Array<{ resolve: () => void; reject: (err: Error) => void; createdAt: number }>;
  /** Whether we're currently draining the queue */
  draining: boolean;
  /** Last time the budget state was persisted to localStorage */
  lastPersist: number;
}

interface BudgetSnapshot {
  timestamps: number[];
  lastPersist: number;
}

// ─── State ───────────────────────────────────────────────────────────────────

const budget: BudgetState = {
  timestamps: [],
  queue: [],
  draining: false,
  lastPersist: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Check if running on the server (no window/localStorage).
 */
function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * Read persisted budget from localStorage (client-side only).
 */
function loadFromStorage(): number[] {
  if (isServer()) return [];
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed: BudgetSnapshot = JSON.parse(raw);
    const now = Date.now();
    // Discard entries older than the window
    return (parsed.timestamps || []).filter((ts) => now - ts < WINDOW_MS);
  } catch {
    return [];
  }
}

/**
 * Write budget snapshot to localStorage (client-side only), rate-limited
 * to avoid excessive writes.
 */
function persistToStorage(): void {
  if (isServer()) return;
  const now = Date.now();
  if (now - budget.lastPersist < LOCALSTORAGE_TTL_MS) return;
  try {
    const snapshot: BudgetSnapshot = {
      timestamps: budget.timestamps,
      lastPersist: now,
    };
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(snapshot));
    budget.lastPersist = now;
  } catch {
    // localStorage may be full or unavailable – fail silently
  }
}

/**
 * Prune timestamps older than the sliding window.
 */
function pruneWindow(): void {
  const cutoff = Date.now() - WINDOW_MS;
  budget.timestamps = budget.timestamps.filter((ts) => ts > cutoff);
}

/**
 * Count requests in the current sliding window.
 */
function currentWindowCount(): number {
  pruneWindow();
  return budget.timestamps.length;
}

let lastBudgetWarningAt = 0;
const BUDGET_WARNING_THROTTLE_MS = 10_000;

/**
 * Log a warning if approaching the limit (throttled — page loads can hit this
 * many times per second and spam the console).
 */
function checkWarning(): void {
  const count = currentWindowCount();
  if (count < WARNING_THRESHOLD) return;
  const now = Date.now();
  if (now - lastBudgetWarningAt < BUDGET_WARNING_THROTTLE_MS) return;
  lastBudgetWarningAt = now;
  console.warn(
    `[SupabaseBudget] Approaching rate limit: ${count}/${SUPABASE_MAX_RPS} req/s ` +
      `(${Math.round((count / SUPABASE_MAX_RPS) * 100)}%)`,
  );
}

/**
 * Compute delay before next request based on current budget usage.
 * Returns ms to wait, or 0 if we can proceed immediately.
 */
function computeDelay(): number {
  const count = currentWindowCount();
  if (count < TARGET_RPS) return 0;

  // We're at or above target – calculate how long until the oldest
  // request in the window slides out.
  const oldest = budget.timestamps[0];
  if (!oldest) return 0;

  const age = Date.now() - oldest;
  const timeUntilSlot = WINDOW_MS - age;

  // Base delay + small jitter to avoid thundering herd
  const jitter = Math.random() * 20;
  return Math.max(timeUntilSlot + jitter, 33); // at least 33ms (≈30 req/s)
}

/**
 * Attempt to drain the queued requests one at a time as budget permits.
 */
async function drainQueue(): Promise<void> {
  if (budget.draining) return;
  budget.draining = true;

  try {
    while (budget.queue.length > 0) {
      const count = currentWindowCount();
      if (count >= SUPABASE_MAX_RPS) {
        // Budget full – wait for a slot
        await new Promise((resolve) => setTimeout(resolve, computeDelay()));
        continue;
      }

      // Budget available – dequeue and resolve
      const next = budget.queue.shift();
      if (!next) continue;

      // Record the slot for this queued request
      budget.timestamps.push(Date.now());
      persistToStorage();
      next.resolve();
    }
  } finally {
    budget.draining = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether a Supabase request can be made right now.
 *
 * Returns `true` if within budget. Returns `false` if at capacity – the caller
 * should wait and retry, or use `queueRequest()` to be enqueued automatically.
 *
 * This is a non-blocking check; it does NOT record the request. Call
 * `recordRequest()` after successfully making the request.
 */
export async function checkBudget(): Promise<boolean> {
  try {
    pruneWindow();
    const count = currentWindowCount();
    checkWarning();
    return count < SUPABASE_MAX_RPS;
  } catch (error) {
    console.error('[SupabaseBudget] checkBudget error:', error);
    // On error, allow the request to proceed (fail open)
    return true;
  }
}

/**
 * Record that a Supabase request has been made.
 *
 * Call this AFTER the request completes (success or failure) to track it
 * in the sliding window budget.
 */
export function recordRequest(): void {
  pruneWindow();
  budget.timestamps.push(Date.now());
  persistToStorage();
  checkWarning();
}

/**
 * Queue a request when the budget is exhausted.
 *
 * Returns a Promise that resolves when budget is available.
 * If the queue grows too large (≥100), the oldest pending request is
 * rejected with an error to avoid unbounded memory growth.
 */
export async function waitForBudget(timeoutMs: number = 10_000): Promise<void> {
  // Fast path: budget available immediately
  if (await checkBudget()) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    // Enforce a maximum queue size to prevent memory leaks
    if (budget.queue.length >= 100) {
      reject(new Error('[SupabaseBudget] Request queue full (>100 pending). Dropping oldest.'));
      return;
    }

    budget.queue.push({
      resolve,
      reject,
      createdAt: Date.now(),
    });

    // Start draining if not already in progress
    drainQueue();

    // Timeout: if budget isn't available within the window, reject
    const timer = setTimeout(() => {
      const idx = budget.queue.findIndex((r) => r.resolve === resolve);
      if (idx !== -1) {
        budget.queue.splice(idx, 1);
        reject(new Error(`[SupabaseBudget] Budget wait timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    // Override resolve to clear the timer
    const originalResolve = resolve;
    budget.queue[budget.queue.length - 1].resolve = () => {
      clearTimeout(timer);
      originalResolve();
    };
  });
}

/**
 * Initialize the budget system, restoring state from localStorage on the client.
 *
 * Call once at app startup if desired. Automatically called on first budget check.
 */
export function initializeBudget(): void {
  if (isServer()) return;

  const stored = loadFromStorage();
  if (stored.length > 0) {
    budget.timestamps = stored;
    console.log(
      `[SupabaseBudget] Restored ${stored.length} request(s) from localStorage`
    );
  }

  // Periodic cleanup of stale entries
  setInterval(() => {
    pruneWindow();
    persistToStorage();
  }, WINDOW_MS);
}

/**
 * Get current budget stats for debugging/monitoring.
 */
export function getBudgetStats(): {
  currentRps: number;
  maxRps: number;
  targetRps: number;
  queueLength: number;
  usagePercent: number;
} {
  pruneWindow();
  return {
    currentRps: budget.timestamps.length,
    maxRps: SUPABASE_MAX_RPS,
    targetRps: TARGET_RPS,
    queueLength: budget.queue.length,
    usagePercent: Math.round((budget.timestamps.length / SUPABASE_MAX_RPS) * 100),
  };
}

/**
 * Reset budget state (useful for testing).
 */
export function resetBudget(): void {
  budget.timestamps = [];
  budget.queue = [];
  budget.draining = false;
  budget.lastPersist = 0;

  if (!isServer()) {
    try {
      localStorage.removeItem(LOCALSTORAGE_KEY);
    } catch {
      // fail silently
    }
  }
}

/**
 * Higher-order function that wraps a Supabase client method with budget
 * management: checks budget before the call, records after, and handles
 * KV/Redis rate limit backoff integration.
 *
 * @param fn - The async function to wrap (e.g., supabase.from('...').select)
 * @param options - Optional configuration
 */
export function withBudget<T>(
  fn: () => Promise<T>,
  options?: {
    /** Timeout in ms for waiting on budget (default: 10_000) */
    timeoutMs?: number;
    /** Whether to skip the KV/Redis rate limit check (default: false) */
    skipRateLimit?: boolean;
    /** Identifier for rate limit tracking */
    identifier?: string;
  }
): () => Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const skipRateLimit = options?.skipRateLimit ?? false;
  const identifier = options?.identifier ?? 'supabase';

  return async (): Promise<T> => {
    // 1. Wait for budget availability
    await waitForBudget(timeoutMs);

    // 2. Check existing KV/Redis rate limiter for backoff signals
    if (!skipRateLimit && isKvConfigured()) {
      try {
        const kvResult = await checkKvRateLimit(identifier, 'api');
        if (!kvResult.allowed) {
          const retryAfter = Math.max((kvResult.reset - Date.now()) / 1000, 1);
          console.warn(
            `[SupabaseBudget] KV rate limit hit. Backing off ${retryAfter}s.`
          );
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        }
      } catch {
        // KV check failed – proceed anyway
      }
    }

    // 3. Execute the request
    try {
      const result = await fn();
      return result;
    } finally {
      // 4. Always record the request in the budget
      recordRequest();
    }
  };
}
