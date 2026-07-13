"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchGatewayRead } from "@/lib/gateway-read-client";
import { isAbortLikeError } from "@/lib/async-guards";
import {
  ALL_CHILDREN_ID,
  DEFAULT_ATTENDANCE_SUMMARY,
  RANGE_OPTIONS,
  type ParentAttendanceData,
  type ParentChildRow,
  type ParentRangeValue,
  type ParentResultRow,
} from "@/components/parent/dashboard/types";

function resolveRangeLabel(value: ParentRangeValue) {
  return RANGE_OPTIONS.find((option) => option.value === value)?.label || "1 month";
}

export function useParentDashboard() {
  const [range, setRange] = useState<ParentRangeValue>("1m");
  const [selectedChildId, setSelectedChildId] = useState<string>(ALL_CHILDREN_ID);
  const [linkedChildren, setLinkedChildren] = useState<ParentChildRow[]>([]);
  const [attendance, setAttendance] = useState<ParentAttendanceData | null>(null);
  const [results, setResults] = useState<ParentResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resultsLoading, setResultsLoading] = useState(true);
  const [error, setError] = useState("");
  const [resultsError, setResultsError] = useState("");

  useEffect(() => {
    const loadChildren = async () => {
      try {
        const response = await fetchGatewayRead("/api/parent/children", {
          cache: "default",
          fallbackToLocal: true,
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ParentChildRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load linked children");
        }

        setLinkedChildren(payload.data || []);
      } catch (loadError: unknown) {
        if (isAbortLikeError(loadError)) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load linked children",
        );
        setLinkedChildren([]);
      }
    };

    void loadChildren();
  }, []);

  useEffect(() => {
    if (!linkedChildren.length) {
      return;
    }

    const childExists =
      selectedChildId === ALL_CHILDREN_ID ||
      linkedChildren.some((child) => child.id === selectedChildId);

    if (!childExists) {
      setSelectedChildId(ALL_CHILDREN_ID);
    }
  }, [linkedChildren, selectedChildId]);

  const selectedChild = useMemo(
    () => linkedChildren.find((child) => child.id === selectedChildId) || null,
    [linkedChildren, selectedChildId],
  );

  const loadAttendance = useCallback(
    async (forceRefresh: boolean) => {
      setError("");
      if (!forceRefresh) {
        setLoading((current) => current || true);
      }
      setRefreshing(forceRefresh);

      try {
        const query = new URLSearchParams({ range });
        if (selectedChildId !== ALL_CHILDREN_ID) {
          query.set("studentId", selectedChildId);
        }

        const response = await fetchGatewayRead(
          `/api/parent/attendance?${query.toString()}`,
          {
            cache: forceRefresh ? "no-store" : "default",
            fallbackToLocal: true,
          },
        );
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ParentAttendanceData;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load attendance");
        }

        setAttendance(payload.data || null);
      } catch (loadError: unknown) {
        if (isAbortLikeError(loadError)) return;
        setAttendance(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load attendance",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range, selectedChildId],
  );

  const loadResults = useCallback(
    async (forceRefresh = false) => {
      setResultsError("");
      setResultsLoading(true);
      if (forceRefresh) {
        setRefreshing(true);
      }

      try {
        const query = new URLSearchParams();
        if (selectedChildId !== ALL_CHILDREN_ID) {
          query.set("studentId", selectedChildId);
        }

        const response = await fetchGatewayRead(
          `/api/parent/results?${query.toString()}`,
          {
            cache: forceRefresh ? "no-store" : "default",
            fallbackToLocal: true,
          },
        );
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ParentResultRow[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load published results");
        }

        setResults(payload.data || []);
      } catch (loadError: unknown) {
        if (isAbortLikeError(loadError)) return;
        setResults([]);
        setResultsError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load published results",
        );
      } finally {
        setResultsLoading(false);
        if (forceRefresh) {
          setRefreshing(false);
        }
      }
    },
    [selectedChildId],
  );

  useEffect(() => {
    void loadAttendance(false);
  }, [loadAttendance]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const refresh = useCallback(() => {
    void loadAttendance(true);
    void loadResults(true);
  }, [loadAttendance, loadResults]);

  const summaryHeading = selectedChild
    ? `${selectedChild.displayName} attendance`
    : linkedChildren.length > 1
      ? "Combined family attendance"
      : "Attendance overview";

  const rangeLabel = resolveRangeLabel(range);
  const summary = attendance?.summary || DEFAULT_ATTENDANCE_SUMMARY;
  const childSummaries = attendance?.children || [];

  return {
    range,
    setRange,
    selectedChildId,
    setSelectedChildId,
    children: linkedChildren,
    attendance,
    selectedChild,
    results,
    loading,
    refreshing,
    resultsLoading,
    error,
    resultsError,
    refresh,
    summaryHeading,
    rangeLabel,
    summary,
    childSummaries,
  };
}
