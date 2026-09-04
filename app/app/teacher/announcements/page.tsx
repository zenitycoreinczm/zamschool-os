"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Bell,
  Calendar,
  Clock,
  Loader2,
  Megaphone,
  Pin,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatDate } from "@/lib/utils";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import {
  TeacherCard,
  TeacherEmptyState,
} from "@/components/teacher/TeacherWorkspaceUI";
import { cn } from "@/lib/utils";
import {
  normalizeAnnouncementRow,
  type AnnouncementRow,
} from "@/components/teacher/dashboard/types";

const PRIORITY_STYLES: Record<string, { badge: string; label: string }> = {
  urgent: {
    badge: "border-rose-200 bg-rose-50 text-rose-800 ring-1 ring-rose-300/40",
    label: "Urgent",
  },
  high: {
    badge: "border-amber-200 bg-amber-50 text-amber-800 ring-1 ring-amber-300/40",
    label: "High Priority",
  },
  normal: {
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    label: "Normal",
  },
  low: {
    badge: "border-slate-200 bg-slate-100 text-slate-600",
    label: "Routine",
  },
};

export default function TeacherAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const loadAnnouncements = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const body = await adminApiJson<{
        success: boolean;
        data: unknown[];
      }>("/api/teacher/announcements");
      setAnnouncements(
        Array.isArray(body.data)
          ? body.data.map((row) =>
              normalizeAnnouncementRow((row || {}) as Record<string, unknown>),
            )
          : [],
      );
      if (isRefresh) toast.success("Announcements refreshed");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load announcements";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  const stats = useMemo(() => {
    const urgent = announcements.filter(
      (a) => a.priority === "urgent" || a.priority === "high",
    ).length;
    const normal = announcements.filter((a) => a.priority === "normal").length;
    return {
      total: announcements.length,
      urgent,
      normal,
    };
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    let list = announcements;
    if (priorityFilter !== "all") {
      list = list.filter((a) => a.priority === priorityFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.body && a.body.toLowerCase().includes(q)) ||
          (a.authorName && a.authorName.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [announcements, priorityFilter, query]);

  const heroStats = [
    {
      label: "Notices total",
      value: announcements.length,
      hint: "School-wide",
      tone: "slate" as const,
    },
    {
      label: "High priority",
      value: stats.urgent,
      hint: stats.urgent > 0 ? "Requires attention" : "All standard",
      tone: stats.urgent > 0 ? ("amber" as const) : ("slate" as const),
    },
    {
      label: "General notices",
      value: stats.normal,
      hint: "Routine circulars",
      tone: "slate" as const,
    },
    {
      label: "Feed status",
      value: "Live",
      hint: "Synchronized",
      tone: "emerald" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <AdminPageHero
        eyebrow="School Communications"
        title="Announcements"
        description="Official school notices, administrative bulletins, and academic memos published by school leadership."
        stats={heroStats}
        accent="slate"
        actions={
          <button
            type="button"
            onClick={() => void loadAnnouncements(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh feed
          </button>
        }
      />

      {/* Toolbar: Filters + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["all", `All (${announcements.length})`],
              ["urgent", "Urgent"],
              ["high", "High"],
              ["normal", "Normal"],
              ["low", "Routine"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPriorityFilter(key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition duration-150",
                priorityFilter === key
                  ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[14rem]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices or author…"
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
      </div>

      {loading ? (
        <TeacherCard className="grid place-items-center py-16 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm text-slate-500">Loading notices…</p>
        </TeacherCard>
      ) : filteredAnnouncements.length === 0 ? (
        <TeacherEmptyState
          icon={Megaphone}
          title={query ? "No matching notices" : "No announcements yet"}
          description={
            query
              ? "Try adjusting your search terms or filter."
              : "School leadership has not published any announcements at this time."
          }
        />
      ) : (
        <div className="grid gap-3.5">
          {filteredAnnouncements.map((a) => {
            const priorityInfo =
              PRIORITY_STYLES[a.priority || "normal"] || PRIORITY_STYLES.normal;

            return (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-slate-950 leading-snug">
                      {a.title}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                        priorityInfo.badge,
                      )}
                    >
                      {priorityInfo.label}
                    </span>
                    {a.priority === "urgent" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-800">
                        <AlertTriangle className="h-3 w-3" />
                        Action Required
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(a.createdAt)}
                  </span>
                </div>

                {a.body && (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap max-w-3xl">
                    {a.body}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-700">
                      {a.authorName || "School Administration"}
                    </span>
                  </div>
                  {a.authorRole && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                      {a.authorRole}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
