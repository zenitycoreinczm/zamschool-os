"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { FocusPills } from "@/components/workspace/FocusPills";
import { useWorkspaceSummary } from "@/components/workspace/useWorkspaceSummary";
import { useWorkspaceData } from "@/components/workspace/workspace-context";
import { adminApiJson } from "@/lib/admin-browser-api";
import { cn } from "@/lib/utils";

type DepartmentRow = {
  id: string;
  name: string;
  description?: string | null;
  head_of_department?: string | null;
  is_default?: boolean | null;
  member_count?: number;
  head?: { label?: string | null; role?: string | null } | null;
};

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  cta: string;
  priority: "high" | "normal";
};

const WORK_AREAS = [
  {
    href: "/app/admin/users",
    title: "Staff directory",
    description:
      "View and update employment details for teachers already on the system. You do not create accounts here.",
    statKey: "staff" as const,
  },
  {
    href: "/app/admin/departments",
    title: "Departments",
    description:
      "Maintain department structure and assign heads of department.",
    statKey: "departments" as const,
  },
  {
    href: "/app/messages",
    title: "Messages",
    description: "Coordinate staffing updates with leadership.",
    statKey: "inbox" as const,
  },
] as const;

export default function HrAdminDashboard() {
  const workspace = useWorkspaceData();
  const {
    metrics,
    highlights,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useWorkspaceSummary();

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [deptLoading, setDeptLoading] = useState(true);
  const [deptError, setDeptError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const schoolName = workspace?.schoolName || "Your school";
  const yearTerm = workspace?.yearTerm || "this term";
  const displayName = workspace?.displayName || "HR administrator";

  const loadDepartments = useCallback(async () => {
    setDeptError("");
    try {
      const body = await adminApiJson<{ data?: DepartmentRow[] }>(
        "/api/school/departments",
      );
      setDepartments(Array.isArray(body?.data) ? body.data : []);
    } catch (err: unknown) {
      setDepartments([]);
      setDeptError(
        err instanceof Error ? err.message : "Could not load departments",
      );
    } finally {
      setDeptLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  const metricMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of metrics) {
      map[m.label.toLowerCase()] = m.value;
    }
    return map;
  }, [metrics]);

  const staffCount = parseMetricNumber(metricMap.staff);
  const teacherCount = parseMetricNumber(metricMap.teachers);
  const inviteCount = parseMetricNumber(metricMap.invites);
  const inboxCount = parseMetricNumber(metricMap.inbox);
  const departmentCount = departments.length;
  const departmentsWithoutHead = departments.filter(
    (d) => !d.head_of_department,
  ).length;

  const heroStats = [
    {
      label: "Staff",
      value: summaryLoading && staffCount == null ? "…" : String(staffCount ?? "0"),
      hint: "All staff roles on directory",
      tone: "slate" as const,
    },
    {
      label: "Teachers",
      value:
        summaryLoading && teacherCount == null ? "…" : String(teacherCount ?? "0"),
      hint: "Teaching accounts",
      tone: "slate" as const,
    },
    {
      label: "Departments",
      value: deptLoading ? "…" : String(departmentCount),
      hint:
        departmentsWithoutHead > 0
          ? `${departmentsWithoutHead} without a head`
          : "School structure",
      tone: "slate" as const,
    },
    {
      label: "Open invites",
      value:
        summaryLoading && inviteCount == null ? "…" : String(inviteCount ?? "0"),
      hint: "Awaiting acceptance (Head Teacher owns invites)",
      tone: "slate" as const,
    },
  ];

  const focusItems =
    highlights.length > 0
      ? highlights
      : [
          "Review staff directory completeness",
          "Keep department heads assigned",
          "Update employment records",
          "Coordinate via Messages",
        ];

  const attention = buildAttentionItems({
    inviteCount,
    departmentsWithoutHead,
    departmentCount,
    deptError,
    staffCount,
    teacherCount,
    inboxCount,
  });

  const areaStats: Record<string, string> = {
    staff: summaryLoading
      ? "…"
      : `${staffCount ?? 0} accounts`,
    departments: deptLoading
      ? "…"
      : `${departmentCount} department${departmentCount === 1 ? "" : "s"}`,
    teachers: summaryLoading
      ? "…"
      : `${teacherCount ?? 0} teacher${teacherCount === 1 ? "" : "s"}`,
    inbox: summaryLoading
      ? "…"
      : `${inboxCount ?? 0} unread`,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setDeptLoading(true);
    try {
      await Promise.all([refreshSummary(), loadDepartments()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-5 p-4 pb-8 md:p-6">
      <AdminPageHero
        eyebrow="People desk"
        title={schoolName}
        description={`Welcome back, ${displayName}. Your HR hub for ${yearTerm} — see staffing levels, department structure, and the work that needs attention.`}
        accent="slate"
        stats={heroStats}
        actions={
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            {refreshing || summaryLoading || deptLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </button>
        }
      />

      <FocusPills items={focusItems} accent="slate" />

      {/* Attention — what needs you now */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Attention
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              What needs you
            </h2>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-slate-600">
            {attention.length}
          </span>
        </div>

        {attention.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
            Nothing urgent right now. Staff counts and departments look in shape —
            use the work areas below for routine updates.
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {attention.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={cn(
                    "group flex items-start justify-between gap-3 rounded-xl border px-4 py-3 transition",
                    item.priority === "high"
                      ? "border-slate-300 bg-slate-50 hover:border-slate-400"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">{item.detail}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                    {item.cta}
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* What you have — live snapshot cards */}
      <section>
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Snapshot
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            What you have
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Live counts for the people and structure you maintain.
          </p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <SnapshotCard
            label="Staff on directory"
            value={
              summaryLoading && staffCount == null
                ? "…"
                : String(staffCount ?? "0")
            }
            hint="Teachers + office staff roles"
            href="/app/admin/users"
          />
          <SnapshotCard
            label="Teachers"
            value={
              summaryLoading && teacherCount == null
                ? "…"
                : String(teacherCount ?? "0")
            }
            hint="Teaching accounts"
            href="/app/admin/users"
          />
          <SnapshotCard
            label="Departments"
            value={deptLoading ? "…" : String(departmentCount)}
            hint={
              departmentsWithoutHead > 0
                ? `${departmentsWithoutHead} need a head`
                : "Structure ready"
            }
            href="/app/admin/departments"
          />
          <SnapshotCard
            label="Unread messages"
            value={
              summaryLoading && inboxCount == null
                ? "…"
                : String(inboxCount ?? "0")
            }
            hint="HR coordination inbox"
            href="/app/messages"
          />
        </div>
      </section>

      {/* What you do — work areas */}
      <section>
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Work areas
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            What you do here
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Open a tool to update records. Staff invitations are sent by the Head
            Teacher — you maintain the people once they are on the system.
          </p>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {WORK_AREAS.map((area) => (
            <Link
              key={area.title}
              href={area.href}
              className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{area.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">
                    {areaStats[area.statKey]}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {area.description}
                </p>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>

      {/* Departments list preview */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Structure
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Departments
            </h2>
          </div>
          <Link
            href="/app/admin/departments"
            className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            Manage
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {deptLoading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading departments…
          </div>
        ) : deptError ? (
          <p className="mt-4 text-sm text-slate-500">{deptError}</p>
        ) : departments.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-500">
            No departments yet. Open Departments to create the structure HR will
            use for assignments.
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">
            {departments.slice(0, 6).map((dept) => (
              <li
                key={dept.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">{dept.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {dept.head?.label
                      ? `Head: ${dept.head.label}`
                      : dept.description || "No head assigned"}
                    {typeof dept.member_count === "number"
                      ? ` · ${dept.member_count} teacher${dept.member_count === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    dept.head_of_department
                      ? "bg-slate-100 text-slate-600"
                      : "bg-slate-900 text-white",
                  )}
                >
                  {dept.head_of_department ? "Head assigned" : "Needs head"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {departments.length > 6 ? (
          <p className="mt-3 text-xs text-slate-400">
            +{departments.length - 6} more under Departments
          </p>
        ) : null}
      </section>

      {/* Ownership note */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Your role vs Head Teacher</p>
          <p className="mt-1 leading-relaxed">
            You update employment records and departments only. You never create
            logins or send invitations — the Head Teacher invites office staff
            and others. When they accept, they appear in your directory to
            complete.
          </p>
        </div>
      </section>
    </div>
  );
}

function SnapshotCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/40"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </Link>
  );
}

function parseMetricNumber(value: string | undefined): number | null {
  if (value == null || value === "" || value === "—") return null;
  const cleaned = String(value).replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function buildAttentionItems(input: {
  inviteCount: number | null;
  departmentsWithoutHead: number;
  departmentCount: number;
  deptError: string;
  staffCount: number | null;
  teacherCount: number | null;
  inboxCount: number | null;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  const teachersReady =
    input.teacherCount != null && input.teacherCount > 0;

  // Empty directory / missing teachers first — unblocks department heads later.
  if (input.staffCount === 0) {
    items.push({
      id: "no-staff",
      title: "Staff directory is empty",
      detail:
        "Ask the Head Teacher to send staff invites. After they accept, complete employment profiles here.",
      href: "/app/admin/users",
      cta: "Open directory",
      priority: "high",
    });
  } else if (input.teacherCount === 0) {
    items.push({
      id: "no-teachers",
      title: "No teachers on the directory yet",
      detail:
        "Teaching accounts appear after the Head Teacher’s invites are accepted — then you can complete records.",
      href: "/app/admin/users",
      cta: "Open directory",
      priority: "high",
    });
  }

  if (input.departmentCount === 0 && !input.deptError) {
    items.push({
      id: "no-depts",
      title: "No departments set up yet",
      detail: "Create departments so staff can be organised by structure.",
      href: "/app/admin/departments",
      cta: "Set up departments",
      priority: "high",
    });
  } else if (input.departmentsWithoutHead > 0) {
    items.push({
      id: "dept-heads",
      title: `${input.departmentsWithoutHead} department${input.departmentsWithoutHead === 1 ? "" : "s"} without a head`,
      detail: teachersReady
        ? "Assign heads of department for clear ownership."
        : "You can open Departments now; assign heads after teachers appear on the directory.",
      href: "/app/admin/departments",
      cta: "Review departments",
      priority: teachersReady ? "high" : "normal",
    });
  }

  if (input.inviteCount != null && input.inviteCount > 0) {
    items.push({
      id: "invites",
      title: `${input.inviteCount} staff invitation${input.inviteCount === 1 ? "" : "s"} still open`,
      detail:
        "Only the Head Teacher manages invites. Open your directory to prepare records for when they accept.",
      href: "/app/admin/users",
      cta: "Open directory",
      priority: "normal",
    });
  }

  if (input.inboxCount != null && input.inboxCount > 0) {
    items.push({
      id: "inbox",
      title: `${input.inboxCount} unread message${input.inboxCount === 1 ? "" : "s"}`,
      detail: "Respond to staffing or leadership messages.",
      href: "/app/messages",
      cta: "Open messages",
      priority: "normal",
    });
  }

  return items.slice(0, 5);
}
