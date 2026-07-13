"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CalendarDays,
  Clock3,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import EventCalendar from "@/components/EventCalendar";
import { PageHeader } from "@/components/workspace/PageHeader";
import { Surface } from "@/components/workspace/Surface";
import { formatDate } from "@/lib/utils";
import {
  DateTimePicker,
  TimeOnlyPicker,
} from "@/components/forms/DateTimePicker";

type EventRow = {
  id: string;
  title: string;
  description?: string | null;
  event_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  target_role?: string | null;
  category?: string | null;
};

const EMPTY_FORM = {
  title: "",
  description: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  location: "",
  targetRole: "all",
};

export default function AppEventsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [scope, setScope] = useState<"upcoming" | "all">("upcoming");
  const [query, setQuery] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedEvent, setSelectedEvent] = useState<EventRow | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const upcomingParam = scope === "upcoming" ? "true" : "false";
      const body = await adminApiJson<{ data?: EventRow[] }>(
        `/api/admin/events?upcomingOnly=${upcomingParam}`
      );
      setEvents(Array.isArray(body.data) ? body.data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
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
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [events, query]);

  async function createEvent() {
    if (!form.title.trim() || !form.eventDate) {
      toast.error("Title and date are required");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Creating event...");
    try {
      await adminApiJson("/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          eventDate: form.eventDate,
          startTime: form.startTime || undefined,
          endTime: form.endTime || undefined,
          location: form.location.trim() || undefined,
          targetRole: form.targetRole === "all" ? null : form.targetRole,
        }),
      });
      setForm(EMPTY_FORM);
      setOpenForm(false);
      await loadEvents();
      toast.success("Event created", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create event", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    const toastId = toast.loading("Deleting event...");
    try {
      await adminApiJson(`/api/admin/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setSelectedEvent(null);
      await loadEvents();
      toast.success("Event deleted", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete event", { id: toastId });
    }
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <PageHeader
        eyebrow="School calendar"
        title="Events"
        description="Plan assemblies, exams, meetings, and school activities in one shared calendar."
        icon={Calendar}
        accent="slate"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <EventCalendar />
        </div>

        <div className="space-y-4">
          <Surface variant="default" className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Event list</h2>
              <button
                type="button"
                onClick={() => setOpenForm(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
              >
                <Plus className="h-3.5 w-3.5" /> New event
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="flex rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScope("upcoming")}
                  className={`px-3 py-2 ${scope === "upcoming" ? "bg-violet-600 text-white rounded-l-lg" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => setScope("all")}
                  className={`px-3 py-2 ${scope === "all" ? "bg-violet-600 text-white rounded-r-lg" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                  {query ? "No events match your search." : "No events scheduled yet."}
                </div>
              ) : (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="block w-full rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 text-left transition hover:border-violet-200 hover:bg-violet-50/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 line-clamp-1">{event.title}</p>
                      {event.category ? (
                        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          {event.category}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {event.event_date ? formatDate(event.event_date) : "Date pending"}
                      </span>
                      {(event.start_time || event.end_time) ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {[event.start_time, event.end_time].filter(Boolean).join(" - ")}
                        </span>
                      ) : null}
                      {event.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      ) : null}
                    </div>
                    {event.description ? (
                      <p className="mt-2 text-xs text-slate-500 line-clamp-2">{event.description}</p>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </Surface>
        </div>
      </div>

      {openForm ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-event-heading"
        >
          <div className="mx-auto grid min-h-full max-w-lg place-items-center">
            <Surface variant="elevated" className="w-full p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">New event</p>
                  <h2 id="new-event-heading" className="mt-1 text-lg font-semibold text-slate-900">Create event</h2>
                </div>
                <button type="button" onClick={() => setOpenForm(false)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Title</span>
                  <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Description</span>
                  <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <DateTimePicker
                  dateValue={form.eventDate}
                  timeValue={form.startTime}
                  onDateChange={(date) => setForm((p) => ({ ...p, eventDate: date }))}
                  onTimeChange={(time) => setForm((p) => ({ ...p, startTime: time }))}
                  dateLabel="Event date"
                  timeLabel="Start time"
                  accent="slate"
                />
                <TimeOnlyPicker
                  label="End time (optional)"
                  value={form.endTime}
                  onChange={(time) => setForm((p) => ({ ...p, endTime: time }))}
                  accent="slate"
                  placeholder="Pick end time"
                />
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Location</span>
                  <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Audience</span>
                  <select
                    value={form.targetRole}
                    onChange={(e) => setForm((p) => ({ ...p, targetRole: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                  >
                    <option value="all">Entire school</option>
                    <option value="admin">Admins only</option>
                    <option value="teacher">Teachers only</option>
                    <option value="student">Students only</option>
                    <option value="parent">Parents only</option>
                  </select>
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setOpenForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
                <button type="button" onClick={() => void createEvent()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create event
                </button>
              </div>
            </Surface>
          </div>
        </div>
      ) : null}

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-details-heading"
        >
          <div className="mx-auto grid min-h-full max-w-lg place-items-center">
            <Surface variant="elevated" className="w-full p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Event details</p>
                  <h2 id="event-details-heading" className="mt-1 text-lg font-semibold text-slate-900">{selectedEvent.title}</h2>
                </div>
                <button type="button" onClick={() => setSelectedEvent(null)} className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-violet-500" />
                    {selectedEvent.event_date ? formatDate(selectedEvent.event_date) : "Date pending"}
                  </span>
                  {(selectedEvent.start_time || selectedEvent.end_time) ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4 text-violet-500" />
                      {[selectedEvent.start_time, selectedEvent.end_time].filter(Boolean).join(" - ")}
                    </span>
                  ) : null}
                  {selectedEvent.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-violet-500" />
                      {selectedEvent.location}
                    </span>
                  ) : null}
                </div>
                {selectedEvent.description ? (
                  <p className="text-sm text-slate-600 leading-6">{selectedEvent.description}</p>
                ) : (
                  <p className="text-sm italic text-slate-400">No description provided.</p>
                )}
                {selectedEvent.target_role ? (
                  <p className="text-xs text-slate-500">Target audience: <span className="font-medium capitalize text-slate-700">{selectedEvent.target_role.replace(/_/g, " ")}</span></p>
                ) : null}
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => setSelectedEvent(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700">Close</button>
                <button type="button" onClick={() => void deleteEvent(selectedEvent.id)} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </Surface>
          </div>
        </div>
      ) : null}
    </div>
  );
}
