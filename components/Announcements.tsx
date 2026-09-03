"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, Megaphone, Pin, Radio } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { isAbortLikeError } from "@/lib/async-guards";
import { fetchAnnouncementsList } from "@/lib/announcements-client";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

type Announcement = {
  id: string;
  title?: string;
  body?: string;
  content?: string;
  created_at?: string;
  published_at?: string;
  is_pinned?: boolean;
};

type AnnouncementsProps = {
  limit?: number;
};

function resolveAnnouncementsEndpoint(params: {
  pathname: string;
  role: string | null | undefined;
  limit: number;
}) {
  const { pathname, role, limit } = params;
  const query = `?limit=${limit}`;
  const roleLower = String(role || "").toLowerCase();
  if (roleLower === "teacher" || pathname.startsWith("/app/teacher")) {
    return `/api/teacher/announcements${query}`;
  }
  // Admin-shell roles (including registrar, deputy etc) that are permitted via
  // requireAdminContext + feature perms should use the admin endpoint.
  // Roles are lowercase from workspace context (normalizeAppWorkspaceRole).
  const adminShellRoles = new Set([
    "principal",
    "super_admin",
    "deputy_head",
    "bursar",
    "guidance_office",
    "academic_admin",
    "hr_admin",
    "ict_admin",
    "discipline_admin",
    "registrar",
    "admin",
  ]);
  if (adminShellRoles.has(roleLower)) {
    return `/api/admin/announcements${query}`;
  }
  return `/api/account/announcements${query}`;
}

function resolveAnnouncementsHref(params: {
  pathname: string;
  role: string | null | undefined;
}) {
  const { pathname, role } = params;
  if (role === "teacher" || pathname.startsWith("/app/teacher")) {
    return "/app/teacher/announcements";
  }
  if (role === "student" || pathname.startsWith("/app/student")) {
    return "/app/student/announcements";
  }
  if (role === "parent" || pathname.startsWith("/app/parent")) {
    return "/app/parent/announcements";
  }
  return "/app/announcements";
}

export default function Announcements({ limit = 3 }: AnnouncementsProps) {
  const pathname = usePathname();
  const { role, data: workspace, loading: workspaceLoading } =
    useWorkspaceContext();
  const schoolId = String(workspace?.schoolId || "").trim();
  // Admin/school list APIs require a tenant; skip doomed 403 round-trips.
  const canFetchSchoolFeed = Boolean(schoolId) || role === "teacher";
  const endpoint = useMemo(
    () => resolveAnnouncementsEndpoint({ pathname, role, limit }),
    [limit, pathname, role],
  );
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadAnnouncements = async () => {
      if (workspaceLoading) {
        setLoading(true);
        return;
      }

      if (!canFetchSchoolFeed) {
        setAnnouncements([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const rows = await fetchAnnouncementsList(endpoint);
        if (cancelled) return;
        setAnnouncements(rows.slice(0, limit) as Announcement[]);
      } catch (err) {
        if (cancelled || isAbortLikeError(err)) {
          if (!cancelled) setAnnouncements([]);
          return;
        }
        console.error("Error fetching announcements:", err);
        setAnnouncements([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [canFetchSchoolFeed, endpoint, limit, workspaceLoading]);

  const viewAllHref = useMemo(
    () => resolveAnnouncementsHref({ pathname, role }),
    [pathname, role],
  );

  return (
    <section className="overflow-hidden rounded-workspace-2xl border border-slate-200 bg-white shadow-workspace-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 md:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-workspace-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200">
            <Megaphone className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                Live bulletin
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                <Radio className="h-3 w-3" aria-hidden />
                School-wide
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              The latest updates shared with your school community.
            </p>
          </div>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1.5 rounded-workspace-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="p-5 md:p-6">
        {loading ? (
          <div
            className="flex min-h-36 items-center justify-center rounded-workspace-xl border border-dashed border-slate-200 bg-slate-50/70"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading the latest updates…
            </div>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex min-h-36 flex-col items-center justify-center rounded-workspace-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center">
            <Megaphone className="h-5 w-5 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Nothing published yet
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              New school updates will appear here when they are shared.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((announcement, index) => (
              <article
                key={announcement.id}
                className="group rounded-workspace-xl border border-slate-200 bg-slate-50/60 p-4 transition duration-150 hover:border-slate-300 hover:bg-white hover:shadow-workspace-xs md:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {index === 0 ? (
                        <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-sky-600">
                          Latest
                        </span>
                      ) : null}
                      {announcement.is_pinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                          <Pin className="h-3 w-3" aria-hidden />
                          Pinned
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-1 text-base font-semibold leading-snug text-slate-900">
                      {announcement.title || "School announcement"}
                    </h3>
                  </div>
                  <time className="shrink-0 pt-0.5 text-xs font-medium text-slate-400">
                    {formatDate(
                      announcement.published_at || announcement.created_at,
                    )}
                  </time>
                </div>
                <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-slate-600 line-clamp-3">
                  {announcement.body || announcement.content || ""}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
