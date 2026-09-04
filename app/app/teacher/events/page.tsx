"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import EventCalendar from "@/components/EventCalendar";
import { Surface } from "@/components/workspace/Surface";
import {
  TeacherCard,
  TeacherEmptyState,
} from "@/components/teacher/TeacherWorkspaceUI";
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
  const [refreshing, setRefreshing] = useState(false);
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [query, setQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const loadEvents = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const upcomingParam = scope === "upcoming" ? "true" : "false";
      const body = await adminApiJson<{ success: boolean; data: unknown[] }>(
        `/api/teacher/events?upcomingOnly=${upcomingParam}&limit=60`,
      );
      setEvents(
        Array.isArray(body.data)
          ? body.data.map((row) =>
              normalizeEventRow((row || {}) as Record<string, unknown>),
            )
          : [],
      );
      if (isRefresh) toast.success("Events refreshed");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load events";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q)),
    );
  }, [events, query]);

  const upcomingCount = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return events.filter((e) => (e.event_date || "") >= todayStr).length;
  }, [events]);

  const heroStats = [
    {
      label: "Total events",
      value: events.length,
      hint: scope === "upcoming" ? "Upcoming view" : "All scheduled",
      tone: "slate" as const,
    },
    {
      label: "Upcoming",
      value: upcomingCount,
      hint: "Active on calendar",
      tone: upcomingCount > 0 ? ("emerald" as const) : ("slate" as const),
    },
    {
      label: "Audience",
      value: "Teachers & Staff",
      hint: "Role-scoped",
      tone: "slate" as const,
    },
    {
      label: "Calendar",
      value: "Synced",
      hint: "Term schedule",
      tone: "sky" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <AdminPageHero
        eyebrow="School Calendar"
        title="Events & Calendar"
        description="Official school term schedule, staff briefings, exam windows, and extracurricular fixtures."
        stats={heroStats}
        accent="slate"
        actions={
          <button
            type="button"
            onClick={() => void loadEvents(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
            />
            Refresh
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Interactive Calendar */}
        <div className="space-y-4 lg:col-span-5 xl:col-span-4">
          <EventCalendar
            endpoint="/api/teacher/events?upcomingOnly=true&limit=60"
            targetHref="/app/teacher/events"
          />
        </div>

        {/* Right Column: Events List with Search & Scope filter */}
        <div className="space-y-4 lg:col-span-7 xl:col-span-8">
          <Surface variant="default" className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-[14rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events, location, or topic…"
                  className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
              </div>

              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setScope("upcoming")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                    scope === "upcoming"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={cn(
                    "rounded-lg px-3 py-1 text-xs font-semibold transition",
                    scope === "all"
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  All
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-400">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-slate-500" />
                  <span className="text-sm">Loading events…</span>
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-xs text-slate-500">
                  {query
                    ? "No events match your search query."
                    : "No events scheduled for this view."}
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="group block w-full rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-sky-700 transition">
                        {event.title}
                      </h3>
                      {event.category ? (
                        <span className="shrink-0 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {event.category}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {event.event_date ? formatDate(event.event_date) : "Date pending"}
                      </span>
                      {event.start_time || event.end_time ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                          {[event.start_time, event.end_time]
                            .filter(Boolean)
                            .map((t) => t?.slice(0, 5))
                            .join(" – ")}
                        </span>
                      ) : null}
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {event.location}
                        </span>
                      ) : null}
                    </div>

                    {event.description ? (
                      <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </Surface>
        </div>
      </div>

      {/* Event Details Modal */}
      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4">
              <div>
                {selectedEvent.category && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                    {selectedEvent.category}
                  </span>
                )}
                <h2 className="mt-2 text-lg font-bold text-slate-900">
                  {selectedEvent.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="grid h-8 w-8 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                {selectedEvent.event_date ? formatDate(selectedEvent.event_date) : "Date pending"}
              </span>
              {selectedEvent.start_time || selectedEvent.end_time ? (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {[selectedEvent.start_time, selectedEvent.end_time]
                    .filter(Boolean)
                    .map((t) => t?.slice(0, 5))
                    .join(" – ")}
                </span>
              ) : null}
              {selectedEvent.location && (
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  {selectedEvent.location}
                </span>
              )}
            </div>

            {selectedEvent.description ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Details
                </p>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedEvent.description}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
