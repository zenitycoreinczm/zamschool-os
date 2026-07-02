"use client";

import { useCallback, useEffect, useState } from "react";

import { adminApiJson } from "@/lib/admin-browser-api";
import type { WorkspaceMetric } from "@/lib/workspace/summary";

type SummaryPayload = {
  data?: {
    metrics?: WorkspaceMetric[];
    highlights?: string[];
  };
};

export function useWorkspaceSummary() {
  const [metrics, setMetrics] = useState<WorkspaceMetric[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await adminApiJson<SummaryPayload | undefined>(
        "/api/workspace/summary",
      );
      // Default to an empty object so .metrics and .highlights accesses below
      // are always safe even when the API returns undefined or an empty body.
      const data = body?.data ?? {};
      setMetrics(Array.isArray(data.metrics) ? data.metrics : []);
      setHighlights(Array.isArray(data.highlights) ? data.highlights : []);
    } catch (err: unknown) {
      setMetrics([]);
      setHighlights([]);
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { metrics, highlights, loading, error, refresh };
}
