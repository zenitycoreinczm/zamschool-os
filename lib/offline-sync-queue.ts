const SYNC_QUEUE_KEY = "zamschool-sync-queue";
const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type SyncQueueItem = {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE" | "PATCH";
  body: any;
  timestamp: number;
  retries: number;
};

type SyncQueueListener = (count: number) => void;
const queueListeners = new Set<SyncQueueListener>();

function notifyListeners() {
  const count = getSyncQueueCount();
  for (const listener of queueListeners) {
    try {
      listener(count);
    } catch {
      /* ignore listener errors */
    }
  }
}

export function subscribeToSyncQueue(listener: SyncQueueListener): () => void {
  queueListeners.add(listener);
  // Emit current count immediately
  listener(getSyncQueueCount());
  return () => queueListeners.delete(listener);
}

export function getSyncQueueCount(): number {
  return loadSyncQueue().length;
}

export function addToSyncQueue(item: Omit<SyncQueueItem, "id" | "timestamp" | "retries">): SyncQueueItem | null {
  try {
    const queue = loadSyncQueue();
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(queueItem);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    notifyListeners();
    return queueItem;
  } catch (error) {
    console.error("Failed to add to sync queue:", error);
    return null;
  }
}

export function loadSyncQueue(): SyncQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const queue = JSON.parse(raw) as SyncQueueItem[];
    
    // Filter expired items
    const now = Date.now();
    const validQueue = queue.filter((item) => now - item.timestamp < QUEUE_TTL_MS);
    
    if (validQueue.length !== queue.length) {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(validQueue));
    }
    
    return validQueue;
  } catch (error) {
    console.error("Failed to load sync queue:", error);
    return [];
  }
}

export function removeFromSyncQueue(id: string): void {
  try {
    const queue = loadSyncQueue();
    const filtered = queue.filter((item) => item.id !== id);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
    notifyListeners();
  } catch (error) {
    console.error("Failed to remove from sync queue:", error);
  }
}

export function clearSyncQueue(): void {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    notifyListeners();
  } catch (error) {
    console.error("Failed to clear sync queue:", error);
  }
}

export async function processSyncQueue(): Promise<{ processed: number; failed: number }> {
  if (typeof window === "undefined" || !isOnline()) {
    return { processed: 0, failed: 0 };
  }

  const queue = loadSyncQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Inject CSRF token (cookie / remembered bootstrap) for mutations
      try {
        const { readCsrfToken } = await import("@/lib/csrf-client");
        const csrf = readCsrfToken();
        if (csrf) headers["X-CSRF-Token"] = csrf;
      } catch {
        const csrfMatch = document.cookie
          .split(";")
          .map((c) => c.trim())
          .find((c) => c.startsWith("csrf-token="));
        if (csrfMatch) {
          headers["X-CSRF-Token"] = csrfMatch.split("=")[1] || "";
        }
      }

      const response = await fetch(item.endpoint, {
        method: item.method,
        headers,
        body: typeof item.body === "string" ? item.body : JSON.stringify(item.body),
        credentials: "same-origin",
      });

      if (response.ok || response.status === 200 || response.status === 201 || response.status === 204) {
        removeFromSyncQueue(item.id);
        processed++;
      } else {
        item.retries++;
        if (item.retries >= 3) {
          removeFromSyncQueue(item.id);
          failed++;
        } else {
          // Update retry count
          const updatedQueue = loadSyncQueue().map((q) =>
            q.id === item.id ? item : q
          );
          localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
          notifyListeners();
        }
      }
    } catch (error) {
      item.retries++;
      if (item.retries >= 3) {
        removeFromSyncQueue(item.id);
        failed++;
      } else {
        const updatedQueue = loadSyncQueue().map((q) =>
          q.id === item.id ? item : q
        );
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
        notifyListeners();
      }
    }
  }

  notifyListeners();
  return { processed, failed };
}

export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}
