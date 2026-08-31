/**
 * Join-or-start request store for hot client reads (unread badges, inbox preview).
 *
 * `force` means "ignore the TTL cache", not "issue a duplicate network request".
 * Callers that force concurrently - e.g. a nav-badge poll and an inbox
 * reconciliation - must still share one in-flight request, otherwise a single
 * logical refresh multiplies into N identical GETs against the API.
 */

export type CoalescedLoadOptions = {
  /** Skip the TTL cache and demand current data. */
  force?: boolean;
  /** How long a successful result may be reused. 0 disables caching. */
  ttlMs?: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  generation: number;
};

type FlightEntry<T> = {
  generation: number;
  promise: Promise<T>;
};

/**
 * Retry ceiling for results that were invalidated mid-flight. Two attempts keep
 * the "never serve pre-invalidate data" guarantee bounded so a caller cannot
 * hang forever on a component that invalidates repeatedly.
 */
const MAX_STALE_RETRIES = 2;

export type CoalescedStore<T> = {
  load: (
    key: string,
    fetcher: () => Promise<T>,
    options?: CoalescedLoadOptions,
  ) => Promise<T>;
  invalidate: () => void;
};

export function createCoalescedStore<T>(): CoalescedStore<T> {
  const cache = new Map<string, CacheEntry<T>>();
  const flights = new Map<string, FlightEntry<T>>();
  let generation = 0;

  async function load(
    key: string,
    fetcher: () => Promise<T>,
    options: CoalescedLoadOptions = {},
  ): Promise<T> {
    const { force = false, ttlMs = 0 } = options;

    for (let attempt = 0; ; attempt += 1) {
      const startedAt = generation;

      if (force) {
        cache.delete(key);
      } else {
        const cached = cache.get(key);
        if (
          cached &&
          cached.generation === startedAt &&
          cached.expiresAt > Date.now()
        ) {
          return cached.value;
        }
      }

      const joined = flights.get(key);
      if (joined && joined.generation === startedAt) {
        const value = await joined.promise;
        if (generation === startedAt || attempt >= MAX_STALE_RETRIES) {
          return value;
        }
        continue;
      }

      const entry: FlightEntry<T> = {
        generation: startedAt,
        promise: (async () => fetcher())(),
      };
      flights.set(key, entry);

      try {
        const value = await entry.promise;
        if (generation === startedAt) {
          if (ttlMs > 0) {
            cache.set(key, {
              value,
              generation: startedAt,
              expiresAt: Date.now() + ttlMs,
            });
          }
          return value;
        }
        if (attempt >= MAX_STALE_RETRIES) return value;
      } finally {
        if (flights.get(key) === entry) flights.delete(key);
      }
    }
  }

  return {
    load,
    invalidate() {
      generation += 1;
      cache.clear();
      flights.clear();
    },
  };
}
