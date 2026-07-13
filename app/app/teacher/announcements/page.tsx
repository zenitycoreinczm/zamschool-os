"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { formatDate } from "@/lib/utils";
import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";
import {
  normalizeAnnouncementRow,
  type AnnouncementRow,
} from "@/components/teacher/dashboard/types";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700",
  high: "bg-amber-100 text-amber-700",
  normal: "bg-sky-100 text-sky-700",
  low: "bg-slate-100 text-slate-500",
};

export default function TeacherAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnnouncements = useCallback(async () => {
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
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load announcements";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnnouncements();
  }, [loadAnnouncements]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 md:p-6">
        <section className="grid w-full max-w-lg place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-slate-500">
            Loading announcements…
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              School updates
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Announcements
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {announcements.length} announcement
              {announcements.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={loadAnnouncements}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200",
              "disabled:opacity-60"
            )}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading && "animate-spin")}
            />
            Refresh
          </button>
        </div>
      </section>

      {announcements.length === 0 ? (
        <Surface variant="dashed" className="py-16 text-center">
          <p className="text-sm font-medium text-slate-600">
            No announcements yet
          </p>
          <p className="mt-1 text-xs text-slate-400">
            School-wide announcements will appear here
          </p>
        </Surface>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a) => (
            <Surface
              key={a.id}
              variant="default"
              className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              as="article"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{a.title}</h3>
                {a.priority && PRIORITY_COLORS[a.priority] && (
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[a.priority]}`}
                  >
                    {a.priority}
                  </span>
                )}
              </div>
              {a.body && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {a.body}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                {a.authorName && <span>By {a.authorName}</span>}
                {a.authorRole && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">
                    {a.authorRole}
                  </span>
                )}
                <span>{formatDate(a.createdAt)}</span>
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
