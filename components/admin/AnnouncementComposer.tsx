"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import { VoiceInput } from "@/components/VoiceInput";

const AUDIENCE_OPTIONS = [
  { value: "", label: "Everyone (all roles)" },
  { value: "leadership", label: "School leadership (Head Teacher + Deputy Head)" },
  { value: "principal", label: "Head Teacher only" },
  { value: "teacher", label: "Teachers" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents / guardians" },
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
      setTitle("");
      setContent("");
      setTargetRole("");
      setTargetClassId("");
      setIsPinned(false);
      onPublished?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to publish announcement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Publish announcement</h2>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Publish as Head Teacher or office staff. Choose audience so readers only see what applies to
        them.
      </p>

      <div className="grid gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Message</span>
          <div className="relative">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-sky-200"
              required
            />
            <div className="absolute bottom-2 right-2">
              <VoiceInput
                onTranscript={(text) => setContent((prev) => prev + text)}
              />
            </div>
          </div>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Audience</span>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
            >
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {classOptions.length > 0 ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Class (optional)</span>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="">All classes in audience</option>
                {classOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="rounded border-slate-300"
          />
          Pin to top of feeds
        </label>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish
        </button>
      </div>
    </form>
  );
}