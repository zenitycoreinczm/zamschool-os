"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import SchoolSetupBanner, {
  persistSetupBannerDismissed,
  readSetupBannerDismissed,
  type SchoolSetupStatus,
} from "@/components/admin-workspaces/SchoolSetupBanner";
import SchoolAdminDashboard from "@/components/dashboard/SchoolAdminDashboard";
import { FocusPills } from "@/components/workspace/FocusPills";
import { SectionIntro } from "@/components/workspace/SectionIntro";
import { metricsToStatCards } from "@/components/workspace/metricIcons";
import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import type { WorkspaceMetric } from "@/lib/workspace/summary";

type InitResults = Record<
  string,
  { status: string; count?: number; error?: string }
>;

const FALLBACK_METRIC_LABELS = [
  { label: "Classes", hint: "Active classes" },
  { label: "Pending Invites", hint: "Awaiting acceptance" },
  { label: "Attendance", hint: "Present rate (7 days)" },
  { label: "Outstanding", hint: "Unpaid fee balances" },
];

const HEAD_TEACHER_FOCUS = [
  "School health",
  "Staff & structure",
  "Finance oversight",
  "Risk & audit",
];

export default function PrincipalWorkspace() {
  // Defensive read - context may not be ready immediately after login.
  const ctxRaw = useWorkspaceContext();
  const ctx = ctxRaw || {};
  const workspace = (ctx as any)?.data ?? null;
  const [setupLoading, setSetupLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SchoolSetupStatus | null>(
    null,
  );
  const [lastResults, setLastResults] = useState<InitResults | null>(null);
  const [setupDismissed, setSetupDismissed] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [liveMetrics, setLiveMetrics] = useState<WorkspaceMetric[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);

  useEffect(() => {
    setSetupDismissed(readSetupBannerDismissed());
  }, []);

  const loadSetupStatus = useCallback(async () => {
    setSetupLoading(true);
    try {
      const body = await adminApiJson<{
        data?: {
          initialized?: boolean;
          departments?: { id: string }[];
          permissionGroups?: { id: string }[];
          settings?: { setting_key: string }[];
        };
      }>("/api/school/initialize").catch(() => null);
      // Silently skip if the endpoint is unavailable (e.g. 403 for some accounts).
      if (!body) { setSetupLoading(false); return; }
      const data =
        (body && typeof body === "object" ? body.data : undefined) ?? {};

      setSetupStatus({
        initialized: Boolean(data.initialized),
        departments: data.departments?.length || 0,
        permissionGroups: data.permissionGroups?.length || 0,
        settings: data.settings?.length || 0,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load school setup status";
      toast.error(message);
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const body = await adminApiJson<{
        data?: { metrics?: WorkspaceMetric[]; highlights?: string[] };
      }>("/api/workspace/summary");
      const data = body?.data;
      setLiveMetrics(data?.metrics || []);
      setHighlights(data?.highlights || []);
    } catch {
      setLiveMetrics([]);
      setHighlights([]);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSetupStatus();
    void loadSummary();
  }, [loadSetupStatus, loadSummary]);

  const runInitialization = async () => {
    setInitializing(true);
    const toastId = toast.loading("Initializing school defaults...");
    try {
      const body = await adminApiJson<{ results?: InitResults }>(
        "/api/school/initialize",
        {
          method: "POST",
        },
      );
      setLastResults(
        (body && typeof body === "object" ? body.results : undefined) ?? null,
      );
      await loadSetupStatus();
      await loadSummary();
      toast.success("School defaults are ready", { id: toastId });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initialize school";
      toast.error(message, { id: toastId });
    } finally {
      setInitializing(false);
    }
  };

  const showSetupBanner = useMemo(() => {
    if (setupDismissed || setupLoading) return false;
    if (!setupStatus) return false;
    return (
      !setupStatus.initialized ||
      setupStatus.departments < 1 ||
      setupStatus.permissionGroups < 1
    );
  }, [setupDismissed, setupLoading, setupStatus]);

  // Students/Teachers belong in School pulse cards, not the overview header.
  const headerMetrics = liveMetrics.filter(
    (m) => {
      const label = String(m.label || "").toLowerCase();
      return label !== "students" && label !== "teachers";
    },
  );

  const heroStats =
    headerMetrics.length > 0
      ? metricsToStatCards(headerMetrics)
      : FALLBACK_METRIC_LABELS.map((item, index) => ({
          label: item.label,
          value: metricsLoading ? "…" : "0",
          hint: item.hint,
          tone: (["sky", "violet", "amber", "emerald"] as const)[index % 4],
        }));

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "Academic context";
  const displayName = workspace?.displayName || "Head Teacher";
  const focusItems = highlights.length > 0 ? highlights : HEAD_TEACHER_FOCUS;
  const unreadMessages = workspace?.unread.messages ?? 0;
  const unreadNotifications = workspace?.unread.notifications ?? 0;
  const hasInbox = unreadMessages > 0 || unreadNotifications > 0;

  const onboarding = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of liveMetrics) {
      const n = Number(String(m.value).replace(/,/g, ""));
      if (Number.isFinite(n)) map[String(m.label || "").toLowerCase()] = n;
    }
    return {
      classCount: map.classes ?? 0,
      studentCount: map.students ?? 0,
      teacherCount: map.teachers ?? 0,
    };
  }, [liveMetrics]);

  const needsOnboardingGuide =
    !setupDismissed &&
    (showSetupBanner ||
      onboarding.classCount < 1 ||
      onboarding.studentCount < 5 ||
      onboarding.teacherCount < 1);

  const liveNotices = useMemo(() => {
    const items: { href: string; label: string }[] = [];
    if (unreadMessages > 0) {
      items.push({
        href: "/app/messages",
        label: `You have ${formatCount(unreadMessages)} message${unreadMessages === 1 ? "" : "s"}`,
      });
    }
    if (unreadNotifications > 0) {
      items.push({
        href: "/app/notifications",
        label: `${formatCount(unreadNotifications)} school update${unreadNotifications === 1 ? "" : "s"}`,
      });
    }
    for (const h of highlights.slice(0, 3)) {
      const lower = h.toLowerCase();
      if (lower.includes("absent")) {
        items.push({ href: "/app/admin/attendance", label: h });
      } else if (lower.includes("invitation")) {
        items.push({ href: "/app/principal/staff", label: h });
      } else if (lower.includes("outstanding") || lower.includes("fee")) {
        items.push({ href: "/app/admin/finance", label: h });
      }
    }
    // Dedupe by label
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
  }, [unreadMessages, unreadNotifications, highlights]);

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHero
        eyebrow="Head Teacher overview"
        title={schoolName}
        description={`Welcome back, ${displayName}. Run the school from here — ${yearTerm}.`}
        accent="slate"
        stats={heroStats}
        actions={
          <>
            <HeroAction href="/app/announcements" label="Send announcement" />
            <HeroAction
              href="/app/admin/attendance"
              label="Mark attendance"
              variant="secondary"
            />
          </>
        }
      />

      {/* Quick actions — one tap */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Quick actions
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            {
              href: "/app/admin/attendance",
              label: "Mark attendance",
              hint: "Take today’s roll",
            },
            {
              href: "/app/admin/academic",
              label: "Submit results",
              hint: "Enter or publish marks",
            },
            {
              href: "/app/announcements",
              label: "Send announcement",
              hint: "Notify parents & staff",
            },
          ].map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition hover:border-sky-300 hover:bg-sky-50/40"
            >
              <p className="text-sm font-semibold text-slate-900">
                {action.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{action.hint}</p>
            </Link>
          ))}
        </div>
      </section>

      {liveNotices.length > 0 || hasInbox ? (
        <div className="flex flex-col gap-2 rounded-workspace-xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-sky-950">
          <span className="font-medium">What&apos;s happening now</span>
          <div className="flex flex-wrap items-center gap-2">
            {liveNotices.length > 0
              ? liveNotices.map((item) => (
                  <InboxChip
                    key={item.label}
                    href={item.href}
                    label={item.label}
                  />
                ))
              : null}
            {liveNotices.length === 0 && unreadMessages > 0 ? (
              <InboxChip
                href="/app/messages"
                label={`${formatCount(unreadMessages)} messages`}
              />
            ) : null}
            {liveNotices.length === 0 && unreadNotifications > 0 ? (
              <InboxChip
                href="/app/notifications"
                label={`${formatCount(unreadNotifications)} notifications`}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <FocusPills items={focusItems} accent="slate" />

      {needsOnboardingGuide ? (
        <SchoolSetupBanner
          loading={setupLoading || metricsLoading}
          initializing={initializing}
          status={setupStatus}
          lastResults={lastResults}
          onboarding={onboarding}
          onInitialize={() => void runInitialization()}
          onDismiss={() => {
            persistSetupBannerDismissed();
            setSetupDismissed(true);
          }}
        />
      ) : null}

      <section>
        <SectionIntro
          title="School pulse"
          description="Live counts, attendance, finance, calendar, and announcements."
        />
        <SchoolAdminDashboard peopleMode="principal" />
      </section>
    </div>
  );
}

function HeroAction({
  href,
  label,
  variant = "primary",
}: {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link
      href={href}
      className={
        variant === "primary"
          ? "inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
          : "inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
      }
    >
      {label}
    </Link>
  );
}

function InboxChip({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/80 bg-white px-3 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-50"
    >
      {label}
    </Link>
  );
}

function formatCount(count: number) {
  return count > 99 ? "99+" : String(count);
}
