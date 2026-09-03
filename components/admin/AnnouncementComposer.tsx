"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  Loader2,
  Megaphone,
  Pin,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { VoiceInput } from "@/components/VoiceInput";

const AUDIENCE_OPTIONS = [
  { value: "", label: "Everyone", hint: "All students, parents, and staff" },
  {
    value: "leadership",
    label: "School leadership",
    hint: "Head Teacher and Deputy Head",
  },
  { value: "principal", label: "Head Teacher", hint: "Head Teacher only" },
  { value: "teacher", label: "Teachers", hint: "Teaching staff" },
  { value: "student", label: "Students", hint: "Students in the school" },
  { value: "parent", label: "Parents / guardians", hint: "Linked family accounts" },
];

type Props = {
  classOptions?: Array<{ id: string; label: string }>;
  onPublished?: () => void;
};

export function AnnouncementComposer({ classOptions = [], onPublished }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selectedAudience = useMemo(
    () =>
      AUDIENCE_OPTIONS.find((option) => option.value === targetRole) ??
      AUDIENCE_OPTIONS[0],
    [targetRole],
  );
  const selectedClass = classOptions.find(
    (option) => option.id === targetClassId,
  );
  const hasDraft = Boolean(
    title.trim() || content.trim() || targetRole || targetClassId || isPinned,
  );

  function clearDraft() {
    setTitle("");
    setContent("");
    setTargetRole("");
    setTargetClassId("");
    setIsPinned(false);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      toast.error("Title and message are required.");
      return;
    }

    setSubmitting(true);
    try {
      await adminApiJson("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: trimmedTitle,
          content: trimmedContent,
          targetRole: targetRole || null,
          targetClassId: targetClassId || null,
          isPinned,
        }),
      });
      toast.success("Announcement published");
      clearDraft();
      onPublished?.();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to publish announcement",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-workspace-2xl border border-slate-200 bg-white shadow-workspace-sm"
    >
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-900 text-white shadow-workspace-xs">
              <Megaphone className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="ws-eyebrow text-slate-400">New bulletin</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                Compose an announcement
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
                Write one clear update, choose the people who need it, and
                publish it to their school portal.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500">
            <Sparkles className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            Keep it clear and useful
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
        <div className="space-y-5 p-5 md:p-6">
          <div className="grid gap-5">
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-slate-700">
                Title
              </span>
              <input
                id="announcement-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Mid-term parent meeting"
                className="w-full rounded-workspace-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-slate-700">
                Message
              </span>
              <div className="relative">
                <textarea
                  id="announcement-message"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Share the details readers need to know…"
                  rows={6}
                  className="w-full resize-y rounded-workspace-lg border border-slate-200 bg-white px-3.5 py-3 pr-11 text-sm leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  required
                />
                <div className="absolute bottom-2.5 right-2.5">
                  <VoiceInput
                    onTranscript={(text) => setContent((previous) => previous + text)}
                  />
                </div>
              </div>
              <span className="mt-1.5 block text-xs text-slate-400">
                Plain text is delivered as written. Keep the first line useful
                for readers scanning their feed.
              </span>
            </label>
          </div>

          <fieldset className="rounded-workspace-xl border border-slate-200 bg-slate-50/60 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Delivery
            </legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Audience
                </span>
                <select
                  id="announcement-audience"
                  value={targetRole}
                  onChange={(event) => setTargetRole(event.target.value)}
                  className="w-full rounded-workspace-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                >
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs text-slate-500">
                  {selectedAudience.hint}
                </span>
              </label>

              {classOptions.length > 0 ? (
                <label className="block text-sm">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Class filter
                  </span>
                  <select
                    id="announcement-class"
                    value={targetClassId}
                    onChange={(event) => setTargetClassId(event.target.value)}
                    className="w-full rounded-workspace-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">All classes in audience</option>
                    {classOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1.5 block text-xs text-slate-500">
                    Optional — narrow this update to one class.
                  </span>
                </label>
              ) : null}
            </div>
          </fieldset>
        </div>

        <aside className="border-t border-slate-200 bg-slate-50/60 p-5 md:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-500" aria-hidden />
              <h3 className="text-sm font-semibold text-slate-800">
                Reader preview
              </h3>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">
              Live
            </span>
          </div>

          <div className="mt-4 rounded-workspace-2xl border border-slate-200 bg-white p-4 shadow-workspace-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ws-eyebrow text-sky-600">School update</p>
                <p className="mt-1 text-xs text-slate-400">
                  {selectedClass ? `${selectedClass.label} · ` : ""}
                  {selectedAudience.label}
                </p>
              </div>
              {isPinned ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                  <Pin className="h-3 w-3" aria-hidden />
                  Pinned
                </span>
              ) : null}
            </div>
            <h4 className="mt-5 text-base font-semibold leading-snug text-slate-950">
              {title.trim() || "Your announcement title"}
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {content.trim() || "Your message will appear here as readers see it."}
            </p>
            <div className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Published to the selected school portal
            </div>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Readers only see announcements intended for their role or class.
            Everyone else stays out of the conversation.
          </p>
        </aside>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-workspace-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
          />
          <span>
            <span className="block font-semibold">Pin to the top</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Keep this update visible above newer posts.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <button
            type="button"
            onClick={clearDraft}
            disabled={!hasDraft || submitting}
            className="inline-flex items-center justify-center rounded-workspace-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-workspace-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-workspace-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
            Publish announcement
          </button>
        </div>
      </div>
    </form>
  );
}
