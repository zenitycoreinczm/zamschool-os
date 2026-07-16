/**
 * Connection Pool Manager for Bursty Traffic
 *
 * Manages concurrent connections to prevent overwhelming Supabase
 * when 100+ users are active simultaneously. Uses a queue system
 * with configurable concurrency limits.
 *
 * Note: In serverless, module state is per-isolate (not global across
 * instances). That is intentional - each isolate self-throttles so a
 * single cold start cannot open unbounded concurrent Supabase calls.
 */

// ─── Configuration ──────────────────────────────────────────────────────────

function envInt(name: string, fallback: number, min: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.floor(n));
}

const MAX_CONCURRENT_REQUESTS = envInt("SUPABASE_POOL_MAX_CONCURRENT", 10, 1);
const MAX_QUEUE_SIZE = envInt("SUPABASE_POOL_MAX_QUEUE", 100, 1);
const QUEUE_TIMEOUT_MS = envInt("SUPABASE_POOL_QUEUE_TIMEOUT_MS", 30_000, 1000);

// ─── State ──────────────────────────────────────────────────────────────────

interface QueueItem {
  resolve: () => void;
  reject: (err: Error) => void;
  createdAt: number;
  userId?: string;
  /** Set true when acquired or timed out so timeout/process never double-settle. */
  settled?: boolean;
  cancelled?: boolean;
}

let activeRequests = 0;
const requestQueue: QueueItem[] = [];
let processing = false;
let cancelledPending = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compact cancelled items from the front of the queue.
 * Full compaction only when cancelled density is high (amortized O(1)).
 */
function compactCancelledHead(): void {
  while (requestQueue.length > 0 && requestQueue[0]?.cancelled) {
    requestQueue.shift();
    if (cancelledPending > 0) cancelledPending--;
  }

  if (
    cancelledPending > 0 &&
    requestQueue.length > 0 &&
    cancelledPending >= Math.max(8, Math.floor(requestQueue.length / 2))
  ) {
    const kept = requestQueue.filter((item) => !item.cancelled);
    requestQueue.length = 0;
    requestQueue.push(...kept);
    cancelledPending = 0;
  }
}

function processQueue(): void {
  if (processing) return;
  processing = true;

  try {
    compactCancelledHead();

    while (
      requestQueue.length > 0 &&
      activeRequests < MAX_CONCURRENT_REQUESTS
    ) {
      const item = requestQueue.shift();
      if (!item) continue;

      if (item.cancelled || item.settled) {
        if (item.cancelled && cancelledPending > 0) cancelledPending--;
        continue;
      }

      item.settled = true;
      activeRequests++;
      item.resolve();
    }
  } finally {
    processing = false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Acquire a connection from the pool.
 * Returns a promise that resolves when a connection is available.
 * Rejects if the queue is full or the request times out.
 */
export function acquireConnection(userId?: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // Fast path: connection available immediately
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      activeRequests++;
      resolve();
      return;
    }

    compactCancelledHead();

    // Queue full - reject immediately
    if (requestQueue.length >= MAX_QUEUE_SIZE) {
      reject(
        new Error(
          `Connection pool full (${MAX_QUEUE_SIZE} queued). Try again later.`,
        ),
      );
      return;
    }

    const item: QueueItem = {
      resolve,
      reject,
      createdAt: Date.now(),
      userId,
    };

    requestQueue.push(item);
    processQueue();

    // O(1) timeout: mark cancelled; processQueue drops without scanning.
    setTimeout(() => {
      if (item.settled || item.cancelled) return;
      item.cancelled = true;
      item.settled = true;
      cancelledPending++;
      reject(
        new Error(`Request timed out after ${QUEUE_TIMEOUT_MS}ms in queue`),
      );
    }, QUEUE_TIMEOUT_MS);
  });
}

/**
 * Release a connection back to the pool.
 */
export function releaseConnection(): void {
  if (activeRequests > 0) {
    activeRequests--;
  }
  processQueue();
}

/**
 * Get current pool statistics.
 */
export function getPoolStats(): {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueue: number;
  utilization: number;
  cancelledPending: number;
} {
  return {
    active: activeRequests,
    queued: requestQueue.length,
    maxConcurrent: MAX_CONCURRENT_REQUESTS,
    maxQueue: MAX_QUEUE_SIZE,
    utilization: Math.round(
      (activeRequests / MAX_CONCURRENT_REQUESTS) * 100,
    ),
    cancelledPending,
  };
}

/**
 * Execute a function within the connection pool.
 * Automatically acquires and releases connections.
 */
export async function withConnection<T>(
  fn: () => Promise<T>,
  userId?: string,
): Promise<T> {
  await acquireConnection(userId);
  try {
    return await fn();
  } finally {
    releaseConnection();
  }
}
