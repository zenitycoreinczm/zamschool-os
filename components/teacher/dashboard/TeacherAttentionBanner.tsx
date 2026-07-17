import Link from "next/link";

import type { TeacherWorkloadSummary } from "@/lib/teacher-route-common";

/**
 * Only surfaces real unread inbox items. Counts come from live unread-summary
 * (via TeacherWorkspaceProvider) so already-read notifications never stick here.
 */
export function TeacherAttentionBanner({
  workload,
}: {
  workload: TeacherWorkloadSummary;
}) {
  const messages = Math.max(0, Number(workload.unreadMessages) || 0);
  const notifications = Math.max(0, Number(workload.unreadNotifications) || 0);

  if (messages <= 0 && notifications <= 0) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900 shadow-sm"
    >
      <span className="font-semibold">Needs your attention:</span>
      {messages > 0 ? (
        <Link
          href="/app/teacher/inbox"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
        >
          {messages} message{messages !== 1 ? "s" : ""}
        </Link>
      ) : null}
      {notifications > 0 ? (
        <Link
          href="/app/teacher/notifications"
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
        >
          {notifications} notification{notifications !== 1 ? "s" : ""}
        </Link>
      ) : null}
    </div>
  );
}
