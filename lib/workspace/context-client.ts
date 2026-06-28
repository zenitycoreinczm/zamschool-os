import { adminApiJson } from "@/lib/admin-browser-api";

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

type WorkspaceContextResponse = {
  success?: boolean;
  data?: WorkspaceContextData;
  error?: string;
};

const WORKSPACE_CONTEXT_TTL_MS = 60_000;

let cachedContext: { expiresAt: number; data: WorkspaceContextData } | null = null;
let contextPromise: Promise<WorkspaceContextData> | null = null;

export function readCachedWorkspaceContext() {
  if (!cachedContext) {
    return null;
  }

  if (Date.now() >= cachedContext.expiresAt) {
    cachedContext = null;
    return null;
  }

  return cachedContext.data;
}

export function invalidateWorkspaceContext() {
  cachedContext = null;
  contextPromise = null;
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

  contextPromise = requestWorkspaceContext()
    .then((data) => {
      cachedContext = {
        expiresAt: Date.now() + WORKSPACE_CONTEXT_TTL_MS,
        data,
      };
      return data;
    })
    .finally(() => {
      contextPromise = null;
    });

  return contextPromise;
}

async function requestWorkspaceContext() {
  const payload = await adminApiJson<WorkspaceContextResponse>("/api/account/workspace-context");
  if (!payload.data) {
    throw new Error(payload.error || "Failed to load workspace context");
  }
  return payload.data;
}
