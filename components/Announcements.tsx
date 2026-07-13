"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { isAbortLikeError } from "@/lib/async-guards";
import { fetchAnnouncementsList } from "@/lib/announcements-client";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";

function resolveAnnouncementsEndpoint(params: {
  pathname: string;
  role: string | null | undefined;
}) {
  const { pathname, role } = params;
  const roleLower = String(role || "").toLowerCase();
  if (roleLower === "teacher" || pathname.startsWith("/app/teacher")) {
    return "/api/teacher/announcements?limit=3";
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
    return "/api/admin/announcements?limit=3";
  }
  return "/api/account/announcements?limit=3";
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

export default function Announcements() {
  const pathname = usePathname();
  const { role, data: workspace, loading: workspaceLoading } =
    useWorkspaceContext();
  const schoolId = String(workspace?.schoolId || "").trim();
  // Admin/school list APIs require a tenant; skip doomed 403 round-trips.
  const canFetchSchoolFeed = Boolean(schoolId) || role === "teacher";
  const endpoint = useMemo(
    () => resolveAnnouncementsEndpoint({ pathname, role }),
    [pathname, role],
  );
  const [announcements, setAnnouncements] = useState<any[]>([]);
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
        setAnnouncements(rows.slice(0, 3));
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
  }, [canFetchSchoolFeed, endpoint, workspaceLoading]);

  const viewAllHref = useMemo(
    () => resolveAnnouncementsHref({ pathname, role }),
    [pathname, role],
  );

  return (
    <div className="bg-white p-6 rounded-workspace-xl shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">Announcements</h2>
        <Link
          href={viewAllHref}
          className="text-xs font-bold text-slate-400 transition hover:text-slate-600 hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-sm text-slate-400">No recent announcements</p>
          </div>
        ) : (
          announcements.map((ann, index) => (
            <div
              key={ann.id}
              className={`rounded-2xl p-4 border transition-all hover:shadow-md ${
                index === 0
                  ? "bg-[#eef8ff] border-[#d9eefc]"
                  : index === 1
                    ? "bg-[#f4f1ff] border-[#e1dbff]"
                    : "bg-[#fff8e8] border-[#f6e7b8]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-800">{ann.title}</h2>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {formatDate(
                    ann.published_at ||
                      ann.created_at ||
                      ann.createdAt ||
                      ann.publishedAt,
                  )}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                {ann.body || ann.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
