import Link from "next/link";

import { cn, formatDate } from "@/lib/utils";
import type { AnnouncementRow } from "@/components/teacher/dashboard/types";

const priorityBadge: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700",
  high: "bg-amber-100 text-amber-700",
  normal: "bg-sky-100 text-sky-700",
  low: "bg-slate-100 text-slate-500",
};

export function TeacherAnnouncementsCard({
  announcements,
  loading,
}: {
  announcements: AnnouncementRow[];
  loading: boolean;
}) {
  return (
    <section
      aria-labelledby="teacher-announcements-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Announcements
          </p>
          <h2
            id="teacher-announcements-heading"
            className="mt-1 text-xl font-semibold text-slate-900"
          >
            Latest updates
          </h2>
        </div>
        <Link
          href="/app/teacher/announcements"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500"
        >
          Loading latest updates…
        </div>
      ) : announcements.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm font-medium text-slate-600">
            No recent announcements
          </p>
          <p className="mt-1 text-xs text-slate-400">
            School-wide announcements will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{a.title}</h3>
                {a.priority && priorityBadge[a.priority] ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      priorityBadge[a.priority],
                    )}
                  >
                    {a.priority}
                  </span>
                ) : null}
              </div>
              {a.body ? (
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{a.body}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-400">
                {a.authorName ? `By ${a.authorName} · ` : ""}
                {formatDate(a.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
