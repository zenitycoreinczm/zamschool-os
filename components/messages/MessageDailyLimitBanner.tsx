"use client";

import type { MessageSendQuota } from "@/lib/messages/quota-types";

function formatQuotaResetTime(resetsAt: string) {
  const date = new Date(resetsAt);
  if (Number.isNaN(date.getTime())) {
    return "tomorrow morning";
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MessageDailyLimitBanner({ quota }: { quota: MessageSendQuota | null }) {
  if (!quota) return null;

  const atLimit = !quota.canSend;
  const resetLabel = formatQuotaResetTime(quota.resetsAt);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              School messages — {quota.limit} per day
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              For school-related contact only: ask a teacher for help, share a number, or arrange
              to meet on campus.
            </p>
          </div>
          {atLimit ? (
            <p className="text-sm font-medium text-slate-800">
              Limit reached — you can send again {resetLabel}.
            </p>
          ) : (
            <p className="text-xs text-slate-500">Allowance resets {resetLabel}.</p>
          )}
        </div>

        <div
          className="flex shrink-0 flex-col justify-between rounded-xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-200/80 sm:w-[9.5rem]"
          aria-label={`${quota.used} of ${quota.limit} messages used today`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Today</p>
          <p className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight text-slate-900">
            {quota.used}
            <span className="text-lg font-semibold text-slate-400">/{quota.limit}</span>
          </p>
          <p className="mt-2 text-xs font-semibold tabular-nums text-slate-600">
            {quota.remaining} left
          </p>
          <div className="mt-3 flex gap-1" role="presentation">
            {Array.from({ length: quota.limit }).map((_, index) => {
              const filled = index < quota.used;
              return (
                <span
                  key={index}
                  title={filled ? "Used" : "Available"}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    filled ? "bg-slate-700" : "bg-slate-200"
                  }`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
