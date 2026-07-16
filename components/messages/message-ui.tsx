"use client";

import type { ReactNode } from "react";
import {
  CheckCheck,
  Inbox,
  Loader2,
  PenLine,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";

import { MESSAGE_BODY_MAX } from "@/lib/messages/compose-limits";
import type { MessageSendQuota } from "@/lib/messages/quota-types";

const transitionBase = "transition-all duration-200 ease-out";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2";

export const messageFieldClass = [
  "w-full rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm",
  transitionBase,
  "placeholder:text-slate-400",
  "hover:border-slate-300",
  "focus:border-slate-400 focus:ring-2 focus:ring-slate-100",
  focusRing,
].join(" ");

export const messageLabelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500";

export const messageSurfaceClass =
  "rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100/80";

export function formatMessageTimestamp(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function MessageCharacterCount({
  value,
  max = MESSAGE_BODY_MAX,
  label = "characters",
}: {
  value: string;
  max?: number;
  label?: string;
}) {
  const length = value.length;
  const ratio = max > 0 ? length / max : 0;
  const tone =
    ratio >= 1 ? "text-slate-900" : ratio >= 0.9 ? "text-slate-600" : "text-slate-400";

  return (
    <p className={`text-[11px] font-medium tabular-nums ${tone}`} aria-live="polite">
      {length}
      <span className="text-slate-300">/</span>
      {max} {label}
    </p>
  );
}

export function MessageQuotaPills({ quota }: { quota: MessageSendQuota | null }) {
  if (!quota) return null;

  const atLimit = !quota.canSend;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tabular-nums ring-1 ${transitionBase} ${
          atLimit
            ? "bg-slate-100 text-slate-900 ring-slate-300/90"
            : "bg-slate-50 text-slate-800 ring-slate-200/90"
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${atLimit ? "bg-slate-700" : "bg-slate-500"}`}
          aria-hidden
        />
        {quota.remaining} of {quota.limit} left today
      </span>
      <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium tabular-nums text-slate-600 ring-1 ring-slate-200/90">
        {quota.used} sent
      </span>
    </div>
  );
}

type MessagesPageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
  quota?: MessageSendQuota | null;
  onCompose?: () => void;
  composeOpen?: boolean;
  canCompose?: boolean;
  composeLabel?: string;
  /** @deprecated All message pages use the unified slate header. */
  accent?: "slate" | "sky" | "indigo" | "teal";
  extraActions?: ReactNode;
};

export function MessagesPageHeader({
  title,
  description,
  eyebrow = "School inbox",
  quota,
  onCompose,
  composeOpen,
  canCompose = true,
  composeLabel = "New message",
  extraActions,
}: MessagesPageHeaderProps) {
  return (
    <section className={`${messageSurfaceClass} overflow-hidden`}>
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-800 to-slate-900 px-5 py-5 text-white sm:px-6">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-slate-400/15 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "20px 20px",
          }}
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/65">
              {eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/88">
              {description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {extraActions}
            {onCompose ? (
              <button
                type="button"
                onClick={onCompose}
                disabled={!canCompose}
                aria-expanded={composeOpen}
                title={
                  canCompose
                    ? undefined
                    : "Daily message limit reached. Try again after your limit resets."
                }
                className={[
                  "inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm",
                  transitionBase,
                  "hover:bg-slate-50 hover:shadow",
                  "active:scale-[0.98]",
                  "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
                  focusRing,
                ].join(" ")}
              >
                <PenLine className="h-4 w-4" strokeWidth={2} aria-hidden />
                {composeOpen ? "Close" : composeLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {quota ? (
        <div className="border-t border-slate-100/90 bg-slate-50/90 px-5 py-3 sm:px-6">
          <MessageQuotaPills quota={quota} />
        </div>
      ) : null}
    </section>
  );
}

type MessageComposePanelProps = {
  children: ReactNode;
  title?: string;
  footer?: ReactNode;
  onCancel?: () => void;
};

export function MessageComposePanel({
  children,
  title = "Compose message",
  footer,
  onCancel,
}: MessageComposePanelProps) {
  return (
    <section className={`${messageSurfaceClass} animate-enter-up p-5 sm:p-6`}>
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-700 ring-1 ring-slate-200/90">
            <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
          </span>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className={`rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 ${focusRing}`}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
      {footer ? (
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

export function MessageSendButton({
  sending,
  disabled,
  onClick,
  label = "Send message",
}: {
  sending: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
  /** @deprecated Use default slate styling. */
  variant?: "slate" | "sky";
}) {
  return (
    <button
      type="button"
      disabled={disabled || sending}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-500/30",
        transitionBase,
        "active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none",
        focusRing,
      ].join(" ")}
    >
      {sending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Send className="h-4 w-4" strokeWidth={2} aria-hidden />
      )}
      {sending ? "Sending…" : label}
    </button>
  );
}

export function MessagesSearchField({
  value,
  onChange,
  placeholder = "Search messages…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search messages"
        className={`${messageFieldClass} pl-10 pr-9`}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${focusRing}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function MessageFilterChips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-xl border border-slate-200/90 bg-slate-50/90 p-0.5"
      role="tablist"
      aria-label="Filter messages"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          onClick={() => onChange(option.id)}
          className={[
            "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
            transitionBase,
            focusRing,
            value === option.id
              ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
              : "text-slate-500 hover:text-slate-800",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MessagesInboxShell({
  title = "Inbox",
  subtitle,
  search,
  filters,
  children,
}: {
  title?: string;
  subtitle?: string;
  search?: ReactNode;
  filters?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={messageSurfaceClass}>
      <div className="flex flex-col gap-3 border-b border-slate-100/90 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs tabular-nums text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-md sm:flex-row sm:items-center">
          {search ? <div className="min-w-0 flex-1">{search}</div> : null}
          {filters}
        </div>
      </div>
      <div className="space-y-2.5 p-3 sm:space-y-3 sm:p-4">{children}</div>
    </section>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 ${className || ""}`}
      aria-hidden
    />
  );
}

export function MessagesPageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading messages">
      <SkeletonBar className="h-28 w-full rounded-2xl" />
      <SkeletonBar className="h-24 w-full rounded-2xl" />
      <div className={`${messageSurfaceClass} space-y-3 p-4`}>
        <SkeletonBar className="h-10 w-full max-w-xs" />
        <SkeletonBar className="h-24 w-full" />
        <SkeletonBar className="h-24 w-full" />
        <SkeletonBar className="h-24 w-full" />
      </div>
    </div>
  );
}

export function MessagesLoadingState({ label = "Loading messages…" }: { label?: string }) {
  return (
    <div
      className="grid min-h-[28vh] place-items-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-slate-500" aria-hidden />
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export function MessagesEmptyState({
  title = "No messages yet",
  description = "When you send or receive school messages, they will appear here.",
  action,
}: {
  title?: string;
  description?: string;
  /** @deprecated Decorative icons removed */
  icon?: typeof Inbox;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200/90 bg-gradient-to-b from-white to-slate-50/60 px-6 py-12 text-center sm:py-14">
      <p className="text-base font-semibold tracking-tight text-slate-800">{title}</p>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function participantInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] || ""}${parts[1]![0] || ""}`.toUpperCase();
}

type MessageThreadCardProps = {
  subject: string;
  body: string;
  participantLabel: string;
  participantRole?: string;
  direction: "sent" | "received";
  timestamp: string;
  isUnread?: boolean;
  onOpen?: () => void;
  onMarkRead?: () => void;
};

export function MessageThreadCard({
  subject,
  body,
  participantLabel,
  participantRole,
  direction,
  timestamp,
  isUnread,
  onOpen,
  onMarkRead,
}: MessageThreadCardProps) {
  const isReceivedUnread = direction === "received" && isUnread;
  const isoTime = timestamp ? new Date(timestamp).toISOString() : undefined;

  return (
    <article
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      aria-label={
        onOpen && isReceivedUnread
          ? `Unread message from ${participantLabel}: ${subject || "Message"}`
          : undefined
      }
      className={[
        "group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm sm:p-5",
        transitionBase,
        focusRing,
        isReceivedUnread
          ? "cursor-pointer border-slate-300 bg-slate-50/80 ring-1 ring-slate-200/80 hover:border-slate-400 hover:shadow-md"
          : "border-slate-200/90 hover:border-slate-300 hover:shadow-md",
      ].join(" ")}
    >
      {isReceivedUnread ? (
        <span
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-slate-800"
          aria-hidden
        />
      ) : null}
      <div className="flex gap-3 sm:gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-tight ring-1 ${
            direction === "sent"
              ? "bg-slate-50 text-slate-700 ring-slate-200/90"
              : "bg-slate-100 text-slate-800 ring-slate-200/90"
          }`}
          aria-hidden
        >
          {participantInitials(participantLabel)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    direction === "sent"
                      ? "bg-slate-100 text-slate-600"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {direction === "sent" ? "Sent" : "Inbox"}
                </span>
                {isReceivedUnread ? (
                  <span className="rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    New
                  </span>
                ) : null}
                {participantRole ? (
                  <span className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    {participantRole}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-1.5 truncate text-[15px] font-semibold leading-snug text-slate-900">
                {subject || "Message"}
              </h3>
              <p className="mt-0.5 truncate text-sm text-slate-500">
                {direction === "sent" ? "To" : "From"}{" "}
                <span className="font-medium text-slate-700">{participantLabel}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <time
                dateTime={isoTime}
                className="text-[11px] font-medium tabular-nums text-slate-400"
              >
                {formatMessageTimestamp(timestamp)}
              </time>
              {isReceivedUnread && onMarkRead ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onMarkRead();
                  }}
                  className={[
                    "rounded-lg border border-slate-200/90 bg-white p-1.5 text-slate-500 shadow-sm",
                    transitionBase,
                    "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                    "hover:border-slate-300 hover:text-slate-900",
                    focusRing,
                  ].join(" ")}
                  title="Mark as read"
                  aria-label="Mark as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600 sm:line-clamp-3">
            {body}
          </p>
        </div>
      </div>
    </article>
  );
}

export function AdminMessageListRow({
  subject,
  routeLabel,
  preview,
  isUnread,
  isIncoming,
  onOpen,
  onMarkRead,
  onDelete,
}: {
  subject: string;
  routeLabel: string;
  preview: string;
  isUnread: boolean;
  isIncoming: boolean;
  onOpen?: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}) {
  return (
    <li
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        onOpen
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className={[
        "group px-4 py-3.5 transition-all duration-200",
        isUnread && isIncoming
          ? "cursor-pointer bg-slate-50 hover:bg-slate-100/80"
          : "bg-white hover:bg-slate-50/80",
        onOpen ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/40" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight text-slate-900">{subject || "No subject"}</p>
          <p className="mt-0.5 text-xs text-slate-500">{routeLabel}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{preview}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              isUnread ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {isUnread ? "Unread" : "Read"}
          </span>
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMarkRead();
              }}
              disabled={!isUnread}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-45"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Read
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function MessageLimitReachedNotice({ quota }: { quota: MessageSendQuota }) {
  return (
    <section
      className="rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 ring-1 ring-slate-200/80"
      role="status"
    >
      <p className="text-sm font-semibold text-slate-900">Daily send limit reached</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        You have used all {quota.limit} messages for today. Your allowance renews when the daily
        counter resets - you can read messages anytime.
      </p>
    </section>
  );
}