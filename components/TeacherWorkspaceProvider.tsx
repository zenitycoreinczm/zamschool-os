"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  fetchTeacherBootstrap,
  invalidateTeacherBootstrap,
  preloadTeacherBootstrap,
  readCachedTeacherBootstrap,
} from "@/lib/teacher-bootstrap-client";
import { fetchShell, readCachedShell, invalidateShell } from "@/lib/shell-client";
import type {
  TeacherBootstrapData,
  TeacherWorkloadSummary,
  TeacherWorkspaceStats,
} from "@/lib/teacher-route-common";

type TeacherWorkspaceAccount = Pick<TeacherBootstrapData, "profile" | "firstLogin" | "teacher">;

type TeacherWorkspaceState = {
  account: TeacherWorkspaceAccount | null;
  stats: TeacherWorkspaceStats;
  workload: TeacherWorkloadSummary;
  loading: boolean;
  error: string;
  displayName: string;
  schoolName: string;
  yearTerm: string;
  refresh: () => Promise<void>;
};

const TeacherWorkspaceContext = createContext<TeacherWorkspaceState | null>(null);

const EMPTY_STATS: TeacherWorkspaceStats = {
  lessons: 0,
  students: 0,
  completed: 0,
  pending: 0,
};

const EMPTY_WORKLOAD: TeacherWorkloadSummary = {
  unreadMessages: 0,
  unreadNotifications: 0,
  pendingGrades: 0,
  draftResults: 0,
  upcomingEvents: 0,
};

function coerceCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeWorkload(
  workload: Partial<TeacherWorkloadSummary> | Record<string, unknown> | null | undefined,
): TeacherWorkloadSummary {
  const w = (workload || {}) as Record<string, unknown>;
  return {
    unreadMessages: coerceCount(w.unreadMessages),
    unreadNotifications: coerceCount(w.unreadNotifications),
    pendingGrades: coerceCount(w.pendingGrades),
    draftResults: coerceCount(w.draftResults),
    upcomingEvents: coerceCount(w.upcomingEvents),
  };
}

export function TeacherWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const cachedBootstrap = readCachedTeacherBootstrap();
  const cachedShell = readCachedShell();
  const initialData = cachedBootstrap?.data || null;
  const shellData = cachedShell;

  const [account, setAccount] = useState<TeacherWorkspaceAccount | null>(() =>
    initialData
      ? {
          profile: initialData.profile,
          firstLogin: initialData.firstLogin,
          teacher: initialData.teacher,
        }
      : null
  );
  const [stats, setStats] = useState<TeacherWorkspaceStats>(() => initialData?.stats || EMPTY_STATS);
  const [workload, setWorkload] = useState<TeacherWorkloadSummary>(() =>
    normalizeWorkload({
      ...(initialData?.workload || EMPTY_WORKLOAD),
      ...(shellData?.shell
        ? {
            pendingGrades: (shellData.shell as any).pendingGrades ?? 0,
            draftResults: (shellData.shell as any).draftResults ?? 0,
          }
        : {}),
    }),
  );
  const [loading, setLoading] = useState(!initialData && !shellData);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState(
    initialData?.displayName || shellData?.displayName || "Your Account"
  );
  const [schoolName, setSchoolName] = useState(
    initialData?.schoolName || shellData?.schoolName || "Your School"
  );
  const [yearTerm, setYearTerm] = useState(
    initialData?.yearTerm || shellData?.yearTerm || "Academic Context"
  );

  const loadWorkspace = useCallback(async (options: { force?: boolean } = {}) => {
    if (!options.force) {
      setLoading(true);
    }
    setError("");

    try {
      // Try shell first for fast UI (cached 30s in Redis)
      if (!options.force && !initialData) {
        try {
          const shell = await fetchShell({ force: options.force });
          setDisplayName(shell.displayName || "Your Account");
          setSchoolName(shell.schoolName || "Your School");
          setYearTerm(shell.yearTerm || "Academic Context");
          if (shell.unread) {
            setWorkload((prev) => ({
              ...prev,
              unreadMessages: shell.unread.messages,
              unreadNotifications: shell.unread.notifications,
              pendingGrades: (shell.shell as any)?.pendingGrades ?? prev.pendingGrades,
              draftResults: (shell.shell as any)?.draftResults ?? prev.draftResults,
            }));
          }
          setLoading(false);
        } catch {
          // Shell failed - fall through to bootstrap
        }
      }

      // Full bootstrap for detailed data (classes, subjects, stats)
      const payload = await fetchTeacherBootstrap({ force: options.force });
      const nextData = payload.data || null;

      setAccount(
        nextData
          ? {
              profile: nextData.profile,
              firstLogin: nextData.firstLogin,
              teacher: nextData.teacher,
            }
          : null
      );
      setStats(nextData?.stats || EMPTY_STATS);
      setWorkload(
        nextData?.workload
          ? normalizeWorkload(nextData.workload)
          : EMPTY_WORKLOAD,
      );
      setDisplayName(nextData?.displayName || "Your Account");
      setSchoolName(nextData?.schoolName || "Your School");
      setYearTerm(nextData?.yearTerm || "Academic Context");
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load teacher workspace");
    } finally {
      setLoading(false);
    }
  }, [initialData]);

  useEffect(() => {
    preloadTeacherBootstrap();
    void loadWorkspace();
  }, [loadWorkspace]);

  const refresh = useCallback(async () => {
    invalidateTeacherBootstrap();
    invalidateShell();
    await loadWorkspace({ force: true });
  }, [loadWorkspace]);

  const value = useMemo(
    () => ({
      account,
      stats,
      workload,
      loading,
      error,
      displayName,
      schoolName,
      yearTerm,
      refresh,
    }),
    [account, displayName, error, loading, refresh, schoolName, stats, workload, yearTerm]
  );

  return (
    <TeacherWorkspaceContext.Provider value={value}>
      {children}
    </TeacherWorkspaceContext.Provider>
  );
}

export function useTeacherWorkspace() {
  const context = useContext(TeacherWorkspaceContext);
  if (!context) {
    throw new Error("useTeacherWorkspace must be used within a TeacherWorkspaceProvider");
  }

  return context;
}
