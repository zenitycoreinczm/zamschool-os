"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { Surface } from "@/components/workspace/Surface";
import { cn, formatDate } from "@/lib/utils";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
};

function normalizeEventRow(row: Record<string, unknown>): EventRow {
  return {
    id: String(row.id ?? ""),
    title: String(row.title || "Untitled event"),
    description:
      typeof row.description === "string" ? row.description : null,
    location: typeof row.location === "string" ? row.location : null,
    event_date:
      typeof row.event_date === "string"
        ? row.event_date
        : typeof row.startDate === "string"
          ? row.startDate
          : null,
    start_time:
      typeof row.start_time === "string"
        ? row.start_time
        : typeof row.startTime === "string"
          ? row.startTime
          : null,
    end_time:
      typeof row.end_time === "string"
        ? row.end_time
        : typeof row.endTime === "string"
          ? row.endTime
          : null,
    category: typeof row.category === "string" ? row.category : null,
  };
}

export default function TeacherEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      const body = await adminApiJson<{ success: boolean; data: unknown[] }>(
        "/api/teacher/events",
      );
      setEvents(
        Array.isArray(body.data)
          ? body.data.map((row) =>
              normalizeEventRow((row || {}) as Record<string, unknown>),
            )
          : [],
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load events";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-4 md:p-6">
        <Surface
          variant="dashed"
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="grid w-full max-w-lg place-items-center p-16"
        >
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-slate-500">Loading events…</p>
        </Surface>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Surface variant="default" className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Calendar
            </p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">
              Events
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={loadEvents}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200",
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
      </Surface>

      {events.length === 0 ? (
        <Surface variant="dashed" className="py-16 text-center">
          <p className="text-sm font-medium text-slate-600">
            No events scheduled
          </p>
          <p className="mt-1 text-xs text-slate-400">
            School events will appear here when scheduled
          </p>
        </Surface>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map((event) => (
            <Surface
              key={event.id}
              variant="default"
              className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"
              as="article"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{event.title}</h3>
                {event.category && (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                    {event.category}
                  </span>
                )}
              </div>
              {event.description && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {event.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span>
                  {event.event_date
                    ? formatDate(event.event_date)
                    : "Date pending"}
                  {event.start_time || event.end_time
                    ? ` · ${[event.start_time, event.end_time].filter(Boolean).join(" – ")}`
                    : ""}
                </span>
                {event.location && (
                  <span>
                    {event.location}
                  </span>
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
