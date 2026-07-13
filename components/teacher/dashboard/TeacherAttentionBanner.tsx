import Link from "next/link";

import type { TeacherWorkloadSummary } from "@/lib/teacher-route-common";

export function TeacherAttentionBanner({
  workload,
}: {
  workload: TeacherWorkloadSummary;
}) {
  if (workload.unreadMessages <= 0 && workload.unreadNotifications <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 shadow-sm"
    >
      <span className="font-semibold">Needs your attention:</span>
      {workload.unreadMessages > 0 ? (
        <Link
          href="/app/teacher/inbox"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
        >
          {workload.unreadMessages} message
          {workload.unreadMessages !== 1 ? "s" : ""}
        </Link>
      ) : null}
      {workload.unreadNotifications > 0 ? (
        <Link
          href="/app/teacher/notifications"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
        >
          {workload.unreadNotifications} notification
          {workload.unreadNotifications !== 1 ? "s" : ""}
        </Link>
      ) : null}
    </div>
  );
}
