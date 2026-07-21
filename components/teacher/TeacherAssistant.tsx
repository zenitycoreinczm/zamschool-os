"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";

type Recommendation = {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  link?: string;
};

const priorityColors: Record<string, string> = {
  high: "border-l-rose-500 bg-rose-50/60",
  medium: "border-l-amber-400 bg-amber-50/60",
  low: "border-l-slate-300 bg-slate-50/60",
};

const priorityLabels: Record<string, string> = {
  high: "Urgent",
  medium: "Soon",
  low: "Later",
};

export function TeacherAssistant() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/ai/teacher-assistant");
      const body = await res.json();
      if (body.success && body.data?.recommendations) {
        setRecommendations(body.data.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch {
      if (!isRefresh) toast.error("Failed to load recommendations");
      setRecommendations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <Surface variant="elevated" className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">AI Assistant</h2>
            <p className="text-xs text-slate-500">
              What to do next
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analysing your workload…
          </div>
        ) : recommendations.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            <p className="font-medium text-slate-600">All clear!</p>
            <p className="mt-1">No urgent tasks need your attention right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl border-l-4 px-4 py-3 transition hover:shadow-sm",
                  priorityColors[rec.priority] || priorityColors.low,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {rec.action}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                          rec.priority === "high"
                            ? "bg-rose-100 text-rose-700"
                            : rec.priority === "medium"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {priorityLabels[rec.priority] || rec.priority}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                      {rec.reason}
                    </p>
                  </div>
                  {rec.link ? (
                    <Link
                      href={rec.link}
                      className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                    >
                      Go
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}
