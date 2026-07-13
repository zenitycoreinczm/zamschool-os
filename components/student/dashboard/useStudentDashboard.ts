"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchGatewayRead } from "@/lib/gateway-read-client";
import type {
  StudentAssignmentRow,
  StudentDashboardPayload,
  StudentResultRow,
} from "@/components/student/dashboard/types";

type DashboardResponse = {
  success?: boolean;
  data?: StudentDashboardPayload;
  error?: string;
};

type ResultsResponse = {
  success?: boolean;
  data?: StudentResultRow[];
  error?: string;
};

export function useStudentDashboard() {
  const [dashboard, setDashboard] = useState<StudentDashboardPayload | null>(null);
  const [results, setResults] = useState<StudentResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (mode: "initial" | "refresh") => {
    if (mode === "initial") setLoading(true);
    else setRefreshing(true);
    setError("");

    try {
      const [dashboardResponse, resultsResponse] = await Promise.all([
        fetchGatewayRead("/api/student/dashboard", {
          // Allow short private cache (server sets dashboardRead headers).
          cache: mode === "refresh" ? "no-store" : "default",
          fallbackToLocal: true,
        }),
        fetchGatewayRead("/api/student/results", {
          cache: mode === "refresh" ? "no-store" : "default",
          fallbackToLocal: true,
        }),
      ]);

      const dashboardPayload =
        (await dashboardResponse.json()) as DashboardResponse;
      const resultsPayload =
        (await resultsResponse.json()) as ResultsResponse;

      if (!dashboardResponse.ok) {
        throw new Error(
          dashboardPayload.error || "Failed to load student dashboard",
        );
      }

      if (!resultsResponse.ok) {
        throw new Error(
          resultsPayload.error || "Failed to load published results",
        );
      }

      setDashboard(dashboardPayload.data || null);
      setResults(resultsPayload.data || []);
    } catch (loadError: unknown) {
      setDashboard(null);
      setResults([]);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load student dashboard",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("initial");
  }, [load]);

  const refresh = useCallback(() => load("refresh"), [load]);

  const submitAssignment = useCallback(
    async (_assignment: StudentAssignmentRow) => {
      await load("refresh");
    },
    [load],
  );

  return {
    dashboard,
    results,
    loading,
    refreshing,
    error,
    refresh,
    submitAssignment,
  };
}
