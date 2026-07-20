/**
 * Wipe client-side workspace / inbox / badge caches so a new login never
 * inherits another user's role shell, unread badges, or sessionStorage.
 */

import { invalidateInboxCaches } from "@/lib/inbox/center-client";
import { invalidateAnnouncementsClientCache } from "@/lib/announcements-client";
import { invalidateEventsClientCache } from "@/lib/events-client";
import {
  invalidateWorkspaceContext,
  invalidateWorkspaceSummary,
} from "@/lib/workspace/context-client";

const LOCAL_PREFIXES = [
  "zamschool_workspace_context",
  "zamschool_workspace",
  "zamschool:inbox",
];

function clearPrefixedStorage(storage: Storage, prefixes: string[]) {
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (!key) continue;
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      storage.removeItem(key);
    }
  } catch {
    // private mode / denied
  }
}

/**
 * Clear in-memory + storage caches for workspace identity and inbox badges.
 * Safe to call from login and logout paths.
 */
export function clearClientAuthCaches() {
  try {
    invalidateWorkspaceContext();
  } catch {
    // ignore
  }
  try {
    invalidateWorkspaceSummary();
  } catch {
    // ignore
  }
  try {
    invalidateInboxCaches();
  } catch {
    // ignore
  }
  try {
    invalidateAnnouncementsClientCache();
  } catch {
    // ignore
  }
  try {
    invalidateEventsClientCache();
  } catch {
    // ignore
  }

  if (typeof window === "undefined") return;

  clearPrefixedStorage(window.sessionStorage, [
    "zamschool_workspace_context",
    "zamschool_workspace",
  ]);
  clearPrefixedStorage(window.localStorage, LOCAL_PREFIXES);

  // Drop SW-cached API shells so the next user never gets stale role HTML/JSON.
  if ("caches" in window) {
    void caches.keys().then((names) =>
      Promise.all(
        names
          .filter(
            (name) =>
              name.includes("zamschool-api") ||
              name.includes("zamschool-routes"),
          )
          .map((name) => caches.delete(name)),
      ),
    );
  }
}
