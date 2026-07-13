"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import {
  readCachedWorkspaceSummary,
} from "@/lib/workspace/context-client";
import type { WorkspaceMetric } from "@/lib/workspace/summary";

type SummaryPayload = {
  data?: {
    metrics?: WorkspaceMetric[];
    highlights?: string[];
    metricsSource?: string;
  };
};

const SESSION_KEY = "zamschool_workspace_summary_v1";
const SESSION_TTL_MS = 5 * 60_000; // avoid re-fetch on soft reloads within 5 min

function readSessionSummary(): {
  metrics: WorkspaceMetric[];
  highlights: string[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      metrics?: WorkspaceMetric[];
      highlights?: string[];
    };
    if (!parsed?.expiresAt || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      metrics: Array.isArray(parsed.metrics) ? parsed.metrics : [],
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    };
  } catch {
    return null;
  }
}

function writeSessionSummary(
  metrics: WorkspaceMetric[],
  highlights: string[],
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        expiresAt: Date.now() + SESSION_TTL_MS,
        metrics,
        highlights,
      }),
    );
  } catch {
    // private mode / quota
  }
}

export function useWorkspaceSummary() {
  const workspace = useWorkspaceContext();
  const schoolId = String(workspace?.data?.schoolId || "").trim();
  const workspaceLoading = workspace?.loading ?? true;
  const bootstrapped = readCachedWorkspaceSummary();
  const sessionBoot = typeof window !== "undefined" ? readSessionSummary() : null;

  const [metrics, setMetrics] = useState<WorkspaceMetric[]>(
    () =>
      (Array.isArray(sessionBoot?.metrics)
        ? sessionBoot!.metrics
        : Array.isArray(bootstrapped?.metrics)
          ? bootstrapped.metrics
          : []) as WorkspaceMetric[],
  );
  const [highlights, setHighlights] = useState<string[]>(
    () =>
      (Array.isArray(sessionBoot?.highlights)
        ? sessionBoot!.highlights
        : Array.isArray(bootstrapped?.highlights)
          ? bootstrapped.highlights
          : []) as string[],
  );
  const [loading, setLoading] = useState(
    !(sessionBoot || bootstrapped?.metrics?.length),
  );
  const [error, setError] = useState("");

  const refresh = useCallback(async (force = false) => {
    // School metrics APIs require a tenant — skip for platform super_admin.
    if (!schoolId) {
      setMetrics([]);
      setHighlights([]);
      setLoading(false);
      setError("");
      return;
    }

    if (!force) {
      const session = readSessionSummary();
      if (session) {
        setMetrics(session.metrics);
        setHighlights(session.highlights);
        setLoading(false);
        return;
      }
      const cached = readCachedWorkspaceSummary();
      if (cached) {
        setMetrics(
          (Array.isArray(cached.metrics)
            ? cached.metrics
            : []) as WorkspaceMetric[],
        );
        setHighlights(
          (Array.isArray(cached.highlights) ? cached.highlights : []) as string[],
        );
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    setError("");
    try {
      const body = await adminApiJson<SummaryPayload | undefined>(
        "/api/workspace/summary",
      );
      const data = body?.data ?? {};
      const nextMetrics = Array.isArray(data.metrics) ? data.metrics : [];
      const nextHighlights = Array.isArray(data.highlights)
        ? data.highlights
        : [];
      setMetrics(nextMetrics);
      setHighlights(nextHighlights);
      writeSessionSummary(nextMetrics, nextHighlights);
    } catch (err: unknown) {
      setMetrics([]);
      setHighlights([]);
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    if (workspaceLoading) return;
    void refresh(false).catch(() => {
      // refresh() already sets error state; guard against unhandled rejections.
    });
  }, [refresh, workspaceLoading]);

  return {
    metrics,
    highlights,
    loading,
    error,
    refresh: () => refresh(true),
  };
}
