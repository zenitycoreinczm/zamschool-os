"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { PageLoading } from "@/components/workspace/PageLoading";
import { Surface } from "@/components/workspace/Surface";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import {
  fetchAccountEventsList,
  type AccountEvent,
} from "@/lib/events-client";
import { markFeedItemRead, markFeedItemsRead } from "@/lib/workspace/nav-badges";
import { formatDate } from "@/lib/utils";

export function AccountEventsPage({
  title = "Events",
  intro = "Upcoming school events relevant to your account.",
  accent = "sky" as HeroAccent,
}: {
  title?: string;
  intro?: string;
  accent?: HeroAccent;
}) {
  const { data: workspace } = useWorkspaceContext();
  const userId = workspace?.userId || "";
  const [rows, setRows] = useState<AccountEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<AccountEvent | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAccountEventsList();
      setRows(data);
      // Visiting the list marks all currently loaded events as seen so badges
      // do not reappear after logout/login on this browser.
      if (userId && data.length > 0) {
        markFeedItemsRead(
          userId,
          "events",
          data.map((row) => String(row.id || "")),
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
    );
  }, [rows, query]);

  if (loading) {
    return (
      <PageLoading
        label="Loading events"
        accent={accent}
        mode="skeleton"
        skeletonVariant="split"
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHero
        eyebrow="School calendar"
        title={title}
        description={intro}
        accent={accent}
        stats={[
          {
            label: "Upcoming",
            value: rows.length,
            hint: "Events scheduled",
            tone: "violet",
          },
        ]}
      />

      {error ? (
        <Surface variant="inset" className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </Surface>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events..."
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <Surface variant="dashed" className="p-8 text-sm text-workspace-muted">
          {query ? "No events match your search." : "No upcoming events scheduled."}
        </Surface>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => {
                setSelectedEvent(event);
                if (userId && event.id) {
                  markFeedItemRead(userId, "events", String(event.id));
                }
              }}
              className="block w-full rounded-xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-violet-200 hover:bg-violet-50/30"
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
                <span>
                  {event.event_date ? formatDate(event.event_date) : "Date pending"}
                </span>
                {event.start_time || event.end_time ? (
                  <span>
                    {[event.start_time, event.end_time].filter(Boolean).join(" - ")}
                  </span>
                ) : null}
                {event.location ? <span>{event.location}</span> : null}
              </div>
              {event.description ? (
                <p className="mt-2 text-xs text-slate-500 line-clamp-2">{event.description}</p>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {portalReady && selectedEvent
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto p-4 sm:p-6"
              role="presentation"
            >
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]"
                onClick={() => setSelectedEvent(null)}
              />
              <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 my-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
                      Event details
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-900">
                      {selectedEvent.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
                  >
                    <span className="text-sm font-bold">&times;</span>
                  </button>
                </div>
                <div className="mt-4 max-h-[min(60vh,28rem)] space-y-3 overflow-y-auto">
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                    <span>
                      {selectedEvent.event_date
                        ? formatDate(selectedEvent.event_date)
                        : "Date pending"}
                    </span>
                    {selectedEvent.start_time || selectedEvent.end_time ? (
                      <span>
                        {[selectedEvent.start_time, selectedEvent.end_time]
                          .filter(Boolean)
                          .join(" - ")}
                      </span>
                    ) : null}
                    {selectedEvent.location ? (
                      <span>{selectedEvent.location}</span>
                    ) : null}
                  </div>
                  {selectedEvent.description ? (
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {selectedEvent.description}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-400">
                      No description provided.
                    </p>
                  )}
                  {selectedEvent.target_role ? (
                    <p className="text-xs text-slate-500">
                      Target audience:{" "}
                      <span className="font-medium capitalize text-slate-700">
                        {selectedEvent.target_role.replace(/_/g, " ")}
                      </span>
                    </p>
                  ) : null}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
