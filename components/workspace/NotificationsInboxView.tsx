"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCheck,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import DetailPanel from "@/components/DetailPanel";
import type { DetailBadge, DetailMetaItem } from "@/components/DetailPanel";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import {
  buildInboxCounts,
  canMarkAllAsRead,
  filterInboxItems,
  type InboxItem,
} from "@/lib/notifications-inbox";
import { cn } from "@/lib/utils";

export type WorkspaceNotificationItem = {
  id: string;
  recordId?: string;
  title: string;
  body: string;
  type: string;
  status: "read" | "unread";
  href: string;
  timestamp: string;
};

type NotificationsInboxViewProps = {
  title?: string;
  intro?: string;
  eyebrow?: string;
  accent?: HeroAccent;
  loading: boolean;
  items: WorkspaceNotificationItem[];
  onMarkRead: (item: WorkspaceNotificationItem) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onRefresh?: () => void;
  refreshing?: boolean;
};

function formatRelativeTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatFullTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function typeBadgeClass(type: string) {
  const normalized = type.toLowerCase();
  if (normalized === "alert" || normalized === "attendance") return "bg-rose-100 text-rose-700";
  if (normalized === "warning") return "bg-amber-100 text-amber-700";
  if (normalized === "announcement") return "bg-violet-100 text-violet-700";
  return "bg-sky-100 text-sky-700";
}

function capitalizeLabel(value: string) {
  if (!value) return "Alert";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatSection(href?: string) {
  if (!href) return "Notifications";
  if (href.includes("/announcements")) return "Announcements";
  if (href.includes("/events")) return "Events";
  if (href.includes("/messages")) return "Messages";
  return "Workspace";
}

const filterTabs = [
  { key: "all" as const, label: "All" },
  { key: "unread" as const, label: "Unread" },
  { key: "read" as const, label: "Read" },
];

export function NotificationsInboxView({
  title = "Notifications",
  intro = "Review alerts, mark items as read, and open related workspace sections.",
  eyebrow = "Inbox triage",
  accent = "sky",
  loading,
  items,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
  refreshing = false,
}: NotificationsInboxViewProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"all" | "unread" | "read">("all");
  const [selected, setSelected] = useState<WorkspaceNotificationItem | null>(null);

  const counts = useMemo(() => buildInboxCounts(items as InboxItem[]), [items]);
  const visible = useMemo(
    () => filterInboxItems(items as InboxItem[], { query, mode }),
    [items, mode, query]
  );

  async function openItem(item: WorkspaceNotificationItem) {
    const next =
      item.status === "unread" ? { ...item, status: "read" as const } : item;
    setSelected(next);
    if (item.status === "unread") {
      await onMarkRead(item);
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHero
        eyebrow={eyebrow}
        title={title}
        description={intro}
        accent={accent}
        stats={[
          {
            label: "All items",
            value: counts.all,
            hint: "Full inbox",
            tone: "slate",
          },
          {
            label: "Unread",
            value: counts.unread,
            hint: counts.unread > 0 ? "Needs attention" : "Inbox clear",
            tone: "sky",
          },
          {
            label: "Read",
            value: counts.read,
            hint: "Already reviewed",
            tone: "emerald",
          },
        ]}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inbox"
                className="w-52 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-300/50 md:w-64"
              />
            </div>
            {onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                Refresh
              </button>
            ) : null}
            {canMarkAllAsRead(items as InboxItem[]) ? (
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                <CheckCheck className="h-4 w-4" />
                Mark all read
              </button>
            ) : null}
          </>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {filterTabs.map((tab) => {
            const active = mode === tab.key;
            const count =
              tab.key === "all"
                ? counts.all
                : tab.key === "unread"
                  ? counts.unread
                  : counts.read;
            const label =
              tab.key === "unread" ? `Unread (${counts.unread})` : tab.label;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMode(tab.key)}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4 md:px-6">
          <h2 className="text-base font-semibold text-slate-900">Inbox items</h2>
          <p className="mt-1 text-sm text-slate-500">
            Unread items are highlighted. Open an item to read the full message and clear your badge.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-600">
              {mode === "unread" ? "No unread notifications" : "No notifications match this view"}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {query.trim()
                ? "Try a different search term or switch the filter."
                : "New school alerts will appear here when they are sent to you."}
            </p>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-slate-100">
            {visible.map((item) => (
              <article
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => void openItem(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    void openItem(item);
                  }
                }}
                className={cn(
                  "cursor-pointer px-4 py-4 transition hover:bg-slate-50/80 md:px-6",
                  item.status === "unread" && "bg-sky-50/50"
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                          item.status === "unread"
                            ? "bg-sky-500 text-white"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {item.status}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize",
                          typeBadgeClass(item.type)
                        )}
                      >
                        {item.type}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
                      {item.body}
                    </p>
                    <p className="text-xs text-slate-400">{formatRelativeTime(item.timestamp)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openItem(item);
                      }}
                      className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      View details
                    </button>
                    {item.status === "unread" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void onMarkRead(item);
                        }}
                        className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <DetailPanel
        open={Boolean(selected)}
        title={selected?.title || ""}
        eyebrow={selected ? `${capitalizeLabel(selected.type)} details` : ""}
        subtitle="Read the full notification, then jump to the related section if you need to act on it."
        badges={selected ? buildBadges(selected) : []}
        meta={selected ? buildMeta(selected) : []}
        onClose={() => setSelected(null)}
        footer={
          selected ? (
            <div className="flex flex-wrap justify-end gap-2">
              {selected.status === "unread" ? (
                <button
                  type="button"
                  onClick={() => void onMarkRead(selected)}
                  className="inline-flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Mark as read
                </button>
              ) : null}
              {selected.href && !selected.href.endsWith("/notifications") ? (
                <Link
                  href={selected.href}
                  className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Go to section
                </Link>
              ) : null}
            </div>
          ) : null
        }
      >
        <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Message
          </p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {selected?.body || "No additional details were provided."}
          </div>
        </section>
      </DetailPanel>
    </div>
  );
}

function buildBadges(item: WorkspaceNotificationItem): DetailBadge[] {
  return [
    { label: item.status, tone: item.status === "unread" ? "accent" : "default" },
    { label: capitalizeLabel(item.type), tone: "default" },
  ];
}

function buildMeta(item: WorkspaceNotificationItem): DetailMetaItem[] {
  return [
    { label: "Received", value: formatFullTime(item.timestamp) },
    { label: "Section", value: formatSection(item.href) },
  ];
}