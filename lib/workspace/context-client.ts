import { adminApiJson } from "@/lib/admin-browser-api";
import { captureCsrfFromResponse, rememberCsrfToken } from "@/lib/csrf-client";

export type WorkspaceContextData = {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  role: string;
  workspaceRole: string;
  schoolId: string | null;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  schoolName: string;
  yearTerm: string;
  unread: {
    messages: number;
    notifications: number;
  };
};

export type WorkspaceBootstrapSummary = {
  role?: string;
  metrics?: Array<{ label: string; value: string; hint?: string }>;
  highlights?: string[];
} | null;

type WorkspaceContextResponse = {
  success?: boolean;
  data?: WorkspaceContextData;
  error?: string;
};

type BootstrapResponse = {
  success?: boolean;
  data?: {
    workspace?: WorkspaceContextData;
    summary?: WorkspaceBootstrapSummary;
  };
  error?: string;
};

let cachedSummary: WorkspaceBootstrapSummary = null;

export function readCachedWorkspaceSummary() {
  return cachedSummary;
}

export function invalidateWorkspaceSummary() {
  cachedSummary = null;
}

/** Memory TTL - long enough to cover multi-page navigations without re-auth fanout. */
const WORKSPACE_CONTEXT_TTL_MS = 3 * 60_000;
const SESSION_STORAGE_KEY = "zamschool_workspace_context_v1";
const SESSION_STORAGE_TTL_MS = 5 * 60_000;
/** Bound sessionStorage entries to this auth user so logins never cross-wire. */
const SESSION_STORAGE_USER_KEY = "zamschool_workspace_context_user_v1";

let cachedContext: { expiresAt: number; data: WorkspaceContextData } | null =
  null;
let contextPromise: Promise<WorkspaceContextData> | null = null;

function readSessionStorageContext(): WorkspaceContextData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      data?: WorkspaceContextData;
      userId?: string;
    };
    if (!parsed?.data || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
      return null;
    }
    const boundUserId = String(
      parsed.userId ||
        sessionStorage.getItem(SESSION_STORAGE_USER_KEY) ||
        "",
    ).trim();
    const dataUserId = String(parsed.data.userId || "").trim();
    // Reject cross-user leftovers from a previous login in the same tab.
    if (boundUserId && dataUserId && boundUserId !== dataUserId) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionStorageContext(data: WorkspaceContextData) {
  if (typeof window === "undefined") return;
  try {
    const userId = String(data.userId || "").trim();
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        expiresAt: Date.now() + SESSION_STORAGE_TTL_MS,
        data,
        userId,
      }),
    );
    if (userId) {
      sessionStorage.setItem(SESSION_STORAGE_USER_KEY, userId);
    }
  } catch {
    // quota / private mode - ignore
  }
}

function clearSessionStorageContext() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(SESSION_STORAGE_USER_KEY);
  } catch {
    // ignore
  }
}

/** Patch unread counts on the in-memory + session workspace cache after mark-read. */
export function patchCachedWorkspaceUnread(unread: {
  messages?: number;
  notifications?: number;
}) {
  // Prefer live memory cache; fall back to sessionStorage so mark-as-read still
  // clears badges even when the in-memory entry expired or never hydrated.
  const current = cachedContext?.data || readSessionStorageContext();
  if (!current) return;

  const next: WorkspaceContextData = {
    ...current,
    unread: {
      messages:
        typeof unread.messages === "number"
          ? Math.max(0, unread.messages)
          : current.unread?.messages ?? 0,
      notifications:
        typeof unread.notifications === "number"
          ? Math.max(0, unread.notifications)
          : current.unread?.notifications ?? 0,
    },
  };

  cachedContext = {
    expiresAt: Date.now() + WORKSPACE_CONTEXT_TTL_MS,
    data: next,
  };
  writeSessionStorageContext(next);
}

function isUsableWorkspaceContext(
  data: WorkspaceContextData | null | undefined,
): data is WorkspaceContextData {
  if (!data?.userId) return false;
  // Super admins may legitimately have no school; everyone else needs one.
  const role = String(data.role || data.workspaceRole || "").toLowerCase();
  if (role === "super_admin") return true;
  return Boolean(String(data.schoolId || "").trim());
}

export function readCachedWorkspaceContext() {
  if (cachedContext) {
    if (
      Date.now() < cachedContext.expiresAt &&
      isUsableWorkspaceContext(cachedContext.data)
    ) {
      return cachedContext.data;
    }
    cachedContext = null;
  }

  const fromSession = readSessionStorageContext();
  if (fromSession && isUsableWorkspaceContext(fromSession)) {
    cachedContext = {
      expiresAt: Date.now() + WORKSPACE_CONTEXT_TTL_MS,
      data: fromSession,
    };
    return fromSession;
  }

  // Drop poisoned session entries that lack schoolId.
  if (fromSession && !isUsableWorkspaceContext(fromSession)) {
    clearSessionStorageContext();
  }

  return null;
}

export function invalidateWorkspaceContext() {
  cachedContext = null;
  contextPromise = null;
  clearSessionStorageContext();
}

async function requestWorkspaceContextWithRetry() {
  const first = await requestWorkspaceContext();
  if (isUsableWorkspaceContext(first)) return first;

  // Transient miss after login / cache purge - one short retry often recovers.
  await new Promise((r) => setTimeout(r, 450));
  return requestWorkspaceContext();
}

export async function fetchWorkspaceContext(options: { force?: boolean } = {}) {
  if (!options.force) {
    const cached = readCachedWorkspaceContext();
    if (cached) {
      return cached;
    }
  }

  if (!options.force && contextPromise) {
    return contextPromise;
  }

  const rawPromise = requestWorkspaceContextWithRetry()
    .then((data) => {
      // Never persist incomplete workspace payloads (missing school).
      if (isUsableWorkspaceContext(data)) {
        cachedContext = {
          expiresAt: Date.now() + WORKSPACE_CONTEXT_TTL_MS,
          data,
        };
        writeSessionStorageContext(data);
      } else {
        cachedContext = null;
        clearSessionStorageContext();
      }
      return data;
    })
    .finally(() => {
      contextPromise = null;
    });

  // Eagerly suppress unhandled-rejection on the shared promise.
  // Each caller still observes the rejection via their own `await`.
  rawPromise.catch(() => {});

  contextPromise = rawPromise;

  return contextPromise;
}

/** True when context is safe to use for school-scoped UI (not a cache false-positive). */
export function isWorkspaceContextReady(
  data: WorkspaceContextData | null | undefined,
): data is WorkspaceContextData {
  return isUsableWorkspaceContext(data);
}

async function requestWorkspaceContext() {
  // Prefer consolidated bootstrap (workspace + optional summary) to cut
  // cold-load fan-out. Fall back to legacy workspace-context on failure.
  try {
    const payload = await adminApiJson<BootstrapResponse>(
      "/api/account/bootstrap",
    );
    const workspace = payload?.data?.workspace;
    if (workspace) {
      if (payload.data?.summary) {
        cachedSummary = payload.data.summary;
      }
      return workspace;
    }
  } catch {
    // fall through
  }

  const payload = await adminApiJson<WorkspaceContextResponse>(
    "/api/account/workspace-context",
  );
  const data = payload?.data;
  if (!data) {
    throw new Error(payload?.error || "Failed to load workspace context");
  }
  return data;
}

/** Eager CSRF cookie re-assert after login / hard refresh. */
export async function warmCsrfToken(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const response = await fetch("/api/account/csrf", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    captureCsrfFromResponse(response);
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        data?: { csrfToken?: string };
      } | null;
      if (body?.data?.csrfToken) rememberCsrfToken(body.data.csrfToken);
    }
  } catch {
    // non-blocking
  }
}
