"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, MoreHorizontal } from "lucide-react";

import { adminApiJson } from "@/lib/admin-browser-api";
import { isAbortLikeError } from "@/lib/async-guards";
import { formatDate } from "@/lib/utils";

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
};

export default function EventCalendar() {
  const router = useRouter();
  const [value, onChange] = useState<Value>(new Date());
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadEvents = async () => {
      try {
        const body = await adminApiJson<{ data?: any[] }>(
          "/api/admin/events?upcomingOnly=true&limit=60",
        );
        if (cancelled) return;

        setEvents(
          (body.data || []).map((row) => ({
            id: String(row.id),
            title: String(row.title || "Untitled event"),
            description: typeof row.description === "string" ? row.description : null,
            event_date: typeof row.event_date === "string" ? row.event_date : null,
            start_time: typeof row.start_time === "string" ? row.start_time : null,
            end_time: typeof row.end_time === "string" ? row.end_time : null,
            location: typeof row.location === "string" ? row.location : null,
          }))
        );
      } catch (error) {
        if (cancelled || isAbortLikeError(error)) return;
        console.error("Error loading event calendar:", error);
        setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadEvents();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDate = Array.isArray(value)
    ? value[0]?.toISOString().slice(0, 10) || ""
    : value?.toISOString().slice(0, 10) || "";
  const selectedEvents = useMemo(
    () => events.filter((event) => event.event_date === selectedDate),
    [events, selectedDate]
  );
  const visibleEvents = selectedEvents.length > 0 ? selectedEvents : events.slice(0, 4);
  const eventDates = useMemo(() => new Set(events.map((event) => event.event_date).filter(Boolean)), [events]);

  return (
    <div className="space-y-4">
      <div className="rounded-workspace-xl bg-white p-4 shadow-sm border border-slate-100 [&_.react-calendar]:w-full [&_.react-calendar]:border-0 [&_.react-calendar]:font-inherit [&_.react-calendar__navigation]:mb-3 [&_.react-calendar__navigation]:items-center [&_.react-calendar__navigation__button]:min-w-0 [&_.react-calendar__navigation__button]:rounded-full [&_.react-calendar__navigation__button]:text-slate-700 [&_.react-calendar__navigation__button]:hover:bg-slate-100 [&_.react-calendar__month-view__weekdays]:text-[11px] [&_.react-calendar__month-view__weekdays]:font-bold [&_.react-calendar__month-view__weekdays]:text-slate-600 [&_.react-calendar__month-view__weekdays__abbr]:no-underline [&_.react-calendar__tile]:rounded-none [&_.react-calendar__tile]:py-3 [&_.react-calendar__tile]:text-sm [&_.react-calendar__tile--now]:bg-lamaSkyLight [&_.react-calendar__tile--active]:bg-lamaSkyLight [&_.react-calendar__tile--active]:text-slate-900">
        <Calendar
          onChange={onChange}
          value={value}
          prevLabel={<ChevronLeft className="h-4 w-4" />}
          nextLabel={<ChevronRight className="h-4 w-4" />}
          prev2Label={<ChevronsLeft className="h-4 w-4" />}
          next2Label={<ChevronsRight className="h-4 w-4" />}
          tileClassName={({ date, view }) =>
            view === "month" && eventDates.has(date.toISOString().slice(0, 10))
              ? "!bg-amber-100 !text-slate-900"
              : undefined
          }
        />
      </div>

      <div className="flex items-center justify-between mt-4">
        <h2 className="text-lg font-semibold text-slate-900">Events</h2>
        <button
          type="button"
          onClick={() => router.push("/app/events")}
          className="grid h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Open events workspace"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-10 shadow-sm grid place-items-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-600">No upcoming events</p>
            <p className="mt-1 text-xs text-slate-400">School events will appear here once they are scheduled.</p>
          </div>
        ) : (
          visibleEvents.map((event) => (
            <button
              type="button"
              className="rounded-workspace-xl border-2 border-slate-100 bg-white px-5 py-5 odd:border-t-lamaSkyLight even:border-t-lamaPurpleLight shadow-workspace-sm"
              key={event.id}
              onClick={() => router.push("/app/events")}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-600">{event.title}</h2>
                <span className="text-slate-300 text-xs">
                  {event.start_time || event.end_time
                    ? [event.start_time, event.end_time].filter(Boolean).join(" - ")
                    : event.event_date
                      ? formatDate(event.event_date)
                      : "-"}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
                {event.event_date ? formatDate(event.event_date) : "Date pending"}
                {event.location ? ` • ${event.location}` : ""}
              </p>
              <p className="mt-2 text-slate-400 text-sm line-clamp-2">
                {event.description || "No event description yet."}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
