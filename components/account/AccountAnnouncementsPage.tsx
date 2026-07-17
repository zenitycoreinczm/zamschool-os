"use client";

import { useCallback, useEffect, useState } from "react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { PageLoading } from "@/components/workspace/PageLoading";
import { Surface } from "@/components/workspace/Surface";
import type { HeroAccent } from "@/components/workspace/heroAccents";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { accountApiJson } from "@/lib/account-portal-api";
import { markFeedItemsRead } from "@/lib/workspace/nav-badges";
import { formatDate } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  body?: string;
  content?: string;
  created_at?: string;
  published_at?: string;
};

export function AccountAnnouncementsPage({
  title = "Announcements",
  intro = "School-wide updates published for your role.",
  accent = "sky" as HeroAccent,
}: {
  title?: string;
  intro?: string;
  accent?: HeroAccent;
}) {
  const { data: workspace } = useWorkspaceContext();
  const userId = workspace?.userId || "";
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const body = await accountApiJson<{ data?: Announcement[] }>(
        "/api/account/announcements?limit=50"
      );
      const data = body.data || [];
      setRows(data);
      // Opening the announcements page marks every loaded item as read so the
      // sidebar badge stays clear after logout/login on this browser.
      if (userId && data.length > 0) {
        markFeedItemsRead(
          userId,
          "announcements",
          data.map((row) => String(row.id || "")),
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load announcements");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <PageLoading
        label="Loading announcements"
        accent={accent}
        mode="skeleton"
        skeletonVariant="list"
      />
    );
  }

  return (
    <div className="space-y-5">
      <AdminPageHero
        eyebrow="School updates"
        title={title}
        description={intro}
        accent={accent}
        stats={[
          {
            label: "Published",
            value: rows.length,
            hint: "In your feed",
            tone: "sky",
          },
          {
            label: "Channel",
            value: "School",
            hint: "Announcements",
            tone: "violet",
          },
          {
            label: "Status",
            value: loading ? "…" : "Live",
            hint: "Read-only",
            tone: "emerald",
          },
        ]}
      />

      {error ? (
        <Surface variant="inset" className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </Surface>
      ) : null}

      {rows.length === 0 ? (
        <Surface variant="dashed" className="p-8 text-sm text-workspace-muted">
          No announcements have been published yet.
        </Surface>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <Surface key={row.id} as="article" variant="default" className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">{row.title}</h2>
                <time className="text-xs text-slate-400">
                  {formatDate(row.published_at || row.created_at || "")}
                </time>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {row.body || row.content || ""}
              </p>
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}