"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";

import Announcements from "@/components/Announcements";
import { AnnouncementComposer } from "@/components/admin/AnnouncementComposer";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { Surface } from "@/components/workspace/Surface";
import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { normalizeRole } from "@/lib/roles";
import { SUPER_ADMIN_DASHBOARD_PATH } from "@/lib/auth-routing";

// Roles that can create/manage announcements.  Only these roles see the
// composer; all others see the read-only feed.
const ANNOUNCEMENT_MANAGER_ROLES = new Set([
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "SUPER_ADMIN",
]);

type ClassOption = { id: string; label: string };

export default function AppAnnouncementsPage() {
  const { role: workspaceRole, data: workspace, loading: workspaceLoading } =
    useWorkspaceContext();
  const normalizedRole = normalizeRole(workspaceRole);
  const schoolId = String(workspace?.schoolId || "").trim();
  const canManageAnnouncements = ANNOUNCEMENT_MANAGER_ROLES.has(
    normalizedRole || "",
  );
  // Platform operators have no school — school feeds and class targeting do not apply.
  const isPlatformOnly =
    normalizedRole === "SUPER_ADMIN" && !workspaceLoading && !schoolId;

  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadClasses = useCallback(async () => {
    if (!schoolId) {
      setClassOptions([]);
      setLoadingClasses(false);
      return;
    }

    setLoadingClasses(true);
    try {
      const body = await adminApiJson<{
        data?: Array<{ id: string; name?: string }>;
      }>("/api/admin/classes");
      const options = (body.data || [])
        .map((row) => ({
          id: row.id,
          label: String(row.name || "").trim() || row.id,
        }))
        .filter((row) => row.id);
      setClassOptions(options);
    } catch {
      setClassOptions([]);
    } finally {
      setLoadingClasses(false);
    }
  }, [schoolId]);

  useEffect(() => {
    // Wait for workspace so we do not fire a doomed admin call for platform users.
    if (workspaceLoading) return;
    void loadClasses();
  }, [loadClasses, workspaceLoading]);

  if (isPlatformOnly) {
    return (
      <div className="space-y-4">
        <AdminPageHero
          eyebrow="Platform"
          title="Announcements"
          description="School announcements are scoped to a tenant. Your super admin account is platform-level and is not linked to a school."
          accent="slate"
          stats={[
            {
              label: "Scope",
              value: "Platform",
              hint: "No school linked",
              tone: "sky",
            },
            {
              label: "Home",
              value: "Console",
              hint: "Access codes & schools",
              tone: "emerald",
            },
          ]}
        />
        <Surface variant="default" className="p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-sky-50 p-2 text-sky-600">
                <Shield className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Use the platform console instead
                </p>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Publish and browse announcements from a school workspace
                  (Head Teacher / staff). Super admin manages access codes and
                  platform operations.
                </p>
              </div>
            </div>
            <Link
              href={SUPER_ADMIN_DASHBOARD_PATH}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Super Admin
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AdminPageHero
        eyebrow="School communications"
        title="Announcements"
        description="Publish once — students, parents, and staff see filtered copies in their portals. Compose below, then review the live feed."
        accent="slate"
        stats={[
          {
            label: "Classes",
            value: loadingClasses ? "…" : classOptions.length,
            hint: "Targeting options",
            tone: "sky",
          },
          {
            label: "Composer",
            value: "Publish",
            hint: "New announcement",
            tone: "sky",
          },
          {
            label: "Feed",
            value: "Live",
            hint: "School-wide",
            tone: "emerald",
          },
        ]}
      />

      {canManageAnnouncements && schoolId && (
        <AnnouncementComposer
          classOptions={classOptions}
          onPublished={() => setRefreshKey((value) => value + 1)}
        />
      )}

      {/* Feed must not wait on class targeting — classes only feed the composer. */}
      {workspaceLoading ? (
        <Surface
          variant="default"
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500"
          as="div"
        >
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          Loading workspace…
        </Surface>
      ) : (
        <Surface variant="default" className="p-4 md:p-6">
          <Announcements key={refreshKey} />
        </Surface>
      )}
    </div>
  );
}
