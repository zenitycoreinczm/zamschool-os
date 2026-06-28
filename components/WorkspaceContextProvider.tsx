"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  fetchWorkspaceContext,
  invalidateWorkspaceContext,
  readCachedWorkspaceContext,
  type WorkspaceContextData,
} from "@/lib/workspace/context-client";
import {
  normalizeAppWorkspaceRole,
  type AppWorkspaceRole,
} from "@/lib/workspace/role";

type WorkspaceContextValue = {
  data: WorkspaceContextData | null;
  role: AppWorkspaceRole;
  loading: boolean;
  error: string;
  refresh: (options?: { force?: boolean }) => Promise<void>;
  invalidate: () => void;
};

const fallbackWorkspaceContext: WorkspaceContextValue = {
  data: null,
  role: null,
  loading: true,
  error: "",
  refresh: async () => {},
  invalidate: () => {},
};

const WorkspaceContext = createContext<WorkspaceContextValue>(
  fallbackWorkspaceContext,
);

export function WorkspaceContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const initial = readCachedWorkspaceContext();
  const [data, setData] = useState<WorkspaceContextData | null>(initial);
  const [loading, setLoading] = useState(!initial);
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
      setData(next);
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
    if (!initial) {
      void load();
    }
  }, [initial, load]);

  const refresh = useCallback(
    async (options: { force?: boolean } = {}) => {
      await load({ force: options.force ?? true });
    },
    [load],
  );

  const invalidate = useCallback(() => {
    invalidateWorkspaceContext();
    setData(null);
  }, []);

  const role = useMemo(
    () => normalizeAppWorkspaceRole(data?.role),
    [data?.role],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      data,
      role,
      loading,
      error,
      refresh,
      invalidate,
    }),
    [data, role, loading, error, refresh, invalidate],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspaceContext() {
  return useContext(WorkspaceContext) || fallbackWorkspaceContext;
}
