"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchWorkspaceContext,
  invalidateWorkspaceContext,
  isWorkspaceContextReady,
  readCachedWorkspaceContext,
  warmCsrfToken,
  type WorkspaceContextData,
} from "@/lib/workspace/context-client";
import { schoolLinkUserMessage } from "@/lib/school-access-error";
import { normalizeAppWorkspaceRole } from "@/lib/workspace/role";
import {
  getWorkspaceContext,
  type WorkspaceContextValue,
} from "@/components/workspace/workspace-context";

export { useWorkspaceContext } from "@/components/workspace/workspace-context";
export type { WorkspaceContextValue } from "@/components/workspace/workspace-context";

export function WorkspaceContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const initial = readCachedWorkspaceContext();
  const [data, setData] = useState<WorkspaceContextData | null>(
    initial && isWorkspaceContextReady(initial) ? initial : null,
  );
  const [loading, setLoading] = useState(!initial || !isWorkspaceContextReady(initial));
  const [error, setError] = useState("");
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async (options: { force?: boolean } = {}) => {
    setError("");
    if (!dataRef.current) {
      setLoading(true);
    }

    try {
      const next = await fetchWorkspaceContext({ force: options.force });
      if (isWorkspaceContextReady(next)) {
        setData(next);
      } else {
        // Do not paint school-scoped UI with a null schoolId false positive.
        if (!dataRef.current) {
          setData(null);
          setError(schoolLinkUserMessage());
        }
      }
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load workspace",
      );
      if (options.force && !dataRef.current) {
        setData(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Re-assert JS-readable CSRF cookie ASAP so registrar/admin mutations work.
    void warmCsrfToken();
    // Always force a network refresh on mount. Cached sessionStorage can belong
    // to a previous user/role after logout+login in the same tab.
    void load({ force: true }).catch(() => {
      // load() already sets error state; guard against unhandled rejections.
    });
  }, [load]);

  const refresh = useCallback(
    async (options: { force?: boolean } = {}) => {
      await load({ force: options.force ?? true });
    },
    [load],
  );

  const invalidate = useCallback(() => {
    // Clear local caches then force a network refresh so avatar/name updates
    // show in the shell header without a full page reload.
    invalidateWorkspaceContext();
    void load({ force: true }).catch(() => {
      // load() already surfaces errors
    });
  }, [load]);

  const role = useMemo(
    () => normalizeAppWorkspaceRole(data?.role),
    [data?.role],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      data: data ?? null,
      role,
      loading: !!loading,
      error: error || "",
      refresh,
      invalidate,
    }),
    [data, role, loading, error, refresh, invalidate],
  );

  const Context = getWorkspaceContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}