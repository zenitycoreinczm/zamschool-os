"use client";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Loader2, MoreHorizontal } from "lucide-react";

import { ChartFrame } from "@/components/charts/ChartFrame";

import { isAbortLikeError } from "@/lib/async-guards";
import { adminApiJson } from "@/lib/admin-browser-api";

type FinancePoint = {
  name: string;
  collected: number;
  pending: number;
};

export default function FinanceChart() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadFinance = async () => {
      try {
        if (cancelled) return;

        const year = new Date().getFullYear();
        const body = await adminApiJson<{ data?: any[] }>(
          `/api/admin/payments?view=chart&year=${year}`,
        );
        setRows(body.data || []);
      } catch (error) {
        if (cancelled || isAbortLikeError(error)) return;
        console.error("Error loading finance chart:", error);
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadFinance();

    return () => {
      cancelled = true;
    };
  }, []);

  const data = useMemo<FinancePoint[]>(() => {
    const currentYear = new Date().getFullYear();
    const months = [
      { name: "Jan", collected: 0, pending: 0 },
      { name: "Feb", collected: 0, pending: 0 },
      { name: "Mar", collected: 0, pending: 0 },
      { name: "Apr", collected: 0, pending: 0 },
      { name: "May", collected: 0, pending: 0 },
      { name: "Jun", collected: 0, pending: 0 },
      { name: "Jul", collected: 0, pending: 0 },
      { name: "Aug", collected: 0, pending: 0 },
      { name: "Sep", collected: 0, pending: 0 },
      { name: "Oct", collected: 0, pending: 0 },
      { name: "Nov", collected: 0, pending: 0 },
      { name: "Dec", collected: 0, pending: 0 },
    ];

    for (const row of rows) {
      const createdAt = String(row?.created_at || "").trim();
      if (!createdAt) continue;

      const createdDate = new Date(createdAt);
      if (
        Number.isNaN(createdDate.getTime()) ||
        createdDate.getFullYear() !== currentYear
      ) {
        continue;
      }

      const monthIndex = createdDate.getMonth();
      const amount = Number(row?.amount || 0);
      const status = String(row?.status || "")
        .trim()
        .toUpperCase();

      if (status === "PAID" || status === "CONFIRMED") {
        months[monthIndex].collected += amount;
      } else if (status === "PENDING") {
        months[monthIndex].pending += amount;
      }
    }

    return months;
  }, [rows]);
  const hasData = data.some((item) => item.collected > 0 || item.pending > 0);

  return (
    <div className="bg-white rounded-workspace-xl w-full h-full min-h-[360px] p-5 flex flex-col shadow-sm border border-slate-100">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Payments</h2>
        <MoreHorizontal className="w-5 h-5 text-gray-400" />
      </div>
      <div className="mt-3 h-[280px] min-h-[240px] w-full min-w-0">
        {loading ? (
          <div className="h-full grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : !hasData ? (
          <div className="h-full grid place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center px-6">
            <div>
              <p className="text-sm font-medium text-slate-600">
                No payment activity yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Collected and pending payment totals will appear here once
                transactions are recorded.
              </p>
            </div>
          </div>
        ) : (
          <ChartFrame minHeight={280}>
            {(size) => (
              <LineChart
                width={size.width}
                height={size.height}
                data={data}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-workspace-border)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tick={{ fill: "var(--color-workspace-border-strong)" }}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  axisLine={false}
                  tick={{ fill: "var(--color-workspace-border-strong)" }}
                  tickLine={false}
                  tickMargin={20}
                />
                <Tooltip />
                <Legend
                  align="center"
                  verticalAlign="top"
                  wrapperStyle={{ paddingTop: "10px", paddingBottom: "30px" }}
                />
                <Line
                  type="monotone"
                  dataKey="collected"
                  stroke="var(--color-chart-collected)"
                  strokeWidth={5}
                />
                <Line
                  type="monotone"
                  dataKey="pending"
                  stroke="var(--color-chart-pending)"
                  strokeWidth={5}
                />
              </LineChart>
            )}
          </ChartFrame>
        )}
      </div>
    </div>
  );
}
