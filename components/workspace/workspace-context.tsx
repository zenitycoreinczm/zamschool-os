"use client";

import { createContext, useContext, type Context } from "react";

import type { WorkspaceContextData } from "@/lib/workspace/context-client";
import type { AppWorkspaceRole } from "@/lib/workspace/role";

export type WorkspaceContextValue = {
  data: WorkspaceContextData | null;
  role: AppWorkspaceRole;
  loading: boolean;
  error: string;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

export const fallbackWorkspaceContext: WorkspaceContextValue = {
  data: null,
  role: null,
  loading: true,
  error: "",
  refresh: async () => {},
  invalidate: () => {},
};

const WORKSPACE_CONTEXT_KEY = "__zamschool_workspace_context__";

type WorkspaceContextGlobal = typeof globalThis & {
  [WORKSPACE_CONTEXT_KEY]?: Context<WorkspaceContextValue>;
};

function createWorkspaceContext(): Context<WorkspaceContextValue> {
  return createContext<WorkspaceContextValue>(fallbackWorkspaceContext);
}

function readStoredWorkspaceContext(): Context<WorkspaceContextValue> | null {
  const existing = (globalThis as WorkspaceContextGlobal)[WORKSPACE_CONTEXT_KEY];
  // Require a real React context shape. A corrupted HMR leftover can expose a
  // partial object with a Provider key that useContext cannot resolve.
  if (
    existing &&
    typeof existing === "object" &&
    "Provider" in existing &&
    "Consumer" in existing
  ) {
    return existing;
  }
  return null;
}

function storeWorkspaceContext(ctx: Context<WorkspaceContextValue>) {
  (globalThis as WorkspaceContextGlobal)[WORKSPACE_CONTEXT_KEY] = ctx;
}

/** Reset a corrupted HMR slot (call from the provider before rendering). */
export function resetWorkspaceContextForHmr() {
  delete (globalThis as WorkspaceContextGlobal)[WORKSPACE_CONTEXT_KEY];
}

// Shared across duplicated webpack chunks (layout + page).
export function getWorkspaceContext(): Context<WorkspaceContextValue> {
  const existing = readStoredWorkspaceContext();
  if (existing) {
    return existing;
  }

  const created = createWorkspaceContext();
  storeWorkspaceContext(created);
  return created;
}

/**
 * Coerce any context value into a complete WorkspaceContextValue.
 * Callers must be able to safely read `.data` even when the provider is
 * missing, mid-HMR, or serving a partial value from a stale chunk.
 */
export function normalizeWorkspaceContextValue(
  value: unknown,
): WorkspaceContextValue {
  if (!value || typeof value !== "object") {
    return fallbackWorkspaceContext;
  }

  const candidate = value as Partial<WorkspaceContextValue>;

  return {
    data: candidate.data ?? null,
    role: (candidate.role ?? null) as AppWorkspaceRole,
    loading:
      typeof candidate.loading === "boolean"
        ? candidate.loading
        : fallbackWorkspaceContext.loading,
    error:
      typeof candidate.error === "string"
        ? candidate.error
        : fallbackWorkspaceContext.error,
    refresh:
      typeof candidate.refresh === "function"
        ? candidate.refresh
        : fallbackWorkspaceContext.refresh,
    invalidate:
      typeof candidate.invalidate === "function"
        ? candidate.invalidate
        : fallbackWorkspaceContext.invalidate,
  };
}

/**
 * Always returns a complete WorkspaceContextValue (never undefined/null).
 * Safe for destructuring: `const { data } = useWorkspaceContext()`.
 */
export function useWorkspaceContext(): WorkspaceContextValue {
  const value = useContext(getWorkspaceContext());
  // normalize is total - but keep the nullish fallback as belt-and-suspenders
  // against unexpected future edits to the normalizer.
  return normalizeWorkspaceContextValue(value) ?? fallbackWorkspaceContext;
}

/** Safe accessor for workspace payload data (null when loading / unavailable). */
export function useWorkspaceData(): WorkspaceContextData | null {
  const ctx = useWorkspaceContext();
  return ctx?.data ?? null;
}
