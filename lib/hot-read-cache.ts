/**
 * Process-local debounce cache for very hot reads (badges, workspace shell).
 * NOT a replacement for Supabase — short TTL only to collapse burst traffic.
 */

import { SUPABASE_PROTECTION } from "./supabase-protection";

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
// In-flight promise map to prevent cache stampedes under burst traffic.
const inFlight = new Map<string, Promise<unknown>>();

export function hotReadKey(parts: string[]) {
  return parts.filter(Boolean).join(":");
}

export async function withHotReadCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  // Deduplicate concurrent fetches for the same key (stampede protection).
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetchFn().then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    inFlight.delete(key);
    return value;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, promise);
  return promise;
}

export function invalidateHotReadKeys(matching: (key: string) => boolean): void {
  for (const key of store.keys()) {
    if (matching(key)) store.delete(key);
  }
}

export function invalidateInboxHotReads(userId: string, schoolId?: string | null): void {
  const uid = String(userId || "").trim();
  if (!uid) return;
  const sid = String(schoolId || "").trim();

  invalidateHotReadKeys((key) => {
    if (key.includes(`user:${uid}`)) return true;
    if (sid && key.includes(`school:${sid}`) && key.includes(`user:${uid}`)) return true;
    return false;
  });
}

export function invalidateWorkspaceHotRead(userId: string): void {
  const uid = String(userId || "").trim();
  if (!uid) return;
  store.delete(hotReadKey(["workspace", `user:${uid}`]));
  store.delete(hotReadKey(["auth-meta", `user:${uid}`]));
}

export const HOT_READ_TTL = {
  unreadCounts: SUPABASE_PROTECTION.unreadCountsTtlSec,
  workspaceStable: SUPABASE_PROTECTION.workspaceStableTtlSec,
  authMeta: SUPABASE_PROTECTION.authMetaTtlSec,
  /** Payments shell / billing summary-style hot reads */
  feesSummary: 30,
} as const;

/** Invalidate fee/payment summary caches for a school (process-local). */
export function invalidateFeesHotReads(schoolId: string): void {
  const sid = String(schoolId || "").trim();
  if (!sid) return;
  invalidateHotReadKeys(
    (key) => key.includes(`school:${sid}`) && key.includes("fees"),
  );
}

if (typeof window === "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }, 60_000).unref?.();
}