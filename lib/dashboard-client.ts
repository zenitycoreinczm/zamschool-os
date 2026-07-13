import { adminApiJson } from "@/lib/admin-browser-api";
import {
  fetchGatewayRead,
  isGatewayConfigured,
} from "@/lib/gateway-read-client";
import type { DashboardSummary } from "@/lib/dashboard-summary-server";

export type {
  DashboardSummary,
  DashboardRoleCounts,
  DashboardStudentTotals,
} from "@/lib/dashboard-summary-server";

export type DashboardScope = {
  schoolId: string;
  academicLabel: string;
};

const DASHBOARD_SUMMARY_TTL_MS = 3 * 60_000;

let cachedSummary: { expiresAt: number; data: DashboardSummary } | null = null;
let summaryPromise: Promise<DashboardSummary> | null = null;

async function fetchSummaryPayload(): Promise<{ data?: DashboardSummary }> {
  const path = "/api/dashboard/summary";
  if (isGatewayConfigured()) {
    // When NEXT_PUBLIC_GATEWAY_URL is set, route through the Worker so the
    // Cache API can serve repeat reads (see CACHEABLE_GET_PREFIXES).
    const response = await fetchGatewayRead(path, {
      cache: "default",
      fallbackToLocal: true,
    });
    if (!response.ok) {
      let body: { error?: string } | null = null;
      try {
        body = (await response.json()) as { error?: string };
      } catch {
        body = null;
      }
      throw new Error(body?.error || "Failed to load dashboard summary");
    }
    return (await response.json()) as { data?: DashboardSummary };
  }
  return adminApiJson<{ data?: DashboardSummary }>(path);
}

export function readCachedDashboardSummary() {
  if (!cachedSummary) {
    return null;
  }

  if (Date.now() >= cachedSummary.expiresAt) {
    cachedSummary = null;
    return null;
  }

  return cachedSummary.data;
}

export function invalidateDashboardSummary() {
  cachedSummary = null;
  summaryPromise = null;
}

export async function fetchDashboardSummary(options: { force?: boolean } = {}) {
  if (!options.force) {
    const cached = readCachedDashboardSummary();
    if (cached) {
      return cached;
    }
  }

  if (!options.force && summaryPromise) {
    return summaryPromise;
  }

  summaryPromise = fetchSummaryPayload()
    .then((payload) => {
      if (!payload.data?.schoolId) {
        throw new Error("Failed to load dashboard summary");
      }
      return payload.data;
    })
    .then((data) => {
      cachedSummary = {
        expiresAt: Date.now() + DASHBOARD_SUMMARY_TTL_MS,
        data,
      };
      return data;
    })
    .finally(() => {
      summaryPromise = null;
    });

  return summaryPromise;
}

/** @deprecated Prefer fetchDashboardSummary — kept for callers that only need scope. */
export async function loadDashboardScope(): Promise<DashboardScope | null> {
  try {
    const summary = await fetchDashboardSummary();
    return {
      schoolId: summary.schoolId,
      academicLabel: summary.academicLabel,
    };
  } catch {
    return null;
  }
}

export function getRoleVariants(role: string) {
  return [role];
}
