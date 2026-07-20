"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import {
  buildPrincipalGuide,
  countCoreProgress,
} from "@/lib/workspace/role-onboarding";

const DISMISS_KEY = "zamschool.principal.setup.dismissed";

export type SchoolSetupStatus = {
  initialized: boolean;
  departments: number;
  permissionGroups: number;
  settings: number;
};

/** Live counts / signals for Head Teacher guidance (not enrolment work). */
export type OnboardingProgress = {
  classCount?: number;
  studentCount?: number;
  teacherCount?: number;
  /** Office staff invited or present (registrar, ICT, etc.) */
  hasOfficeStaff?: boolean;
  hasAnnouncement?: boolean;
  hasEvent?: boolean;
  lateRollCalls?: number;
};

type SchoolSetupBannerProps = {
  loading: boolean;
  initializing: boolean;
  status: SchoolSetupStatus | null;
  lastResults: Record<string, { status: string; count?: number; error?: string }> | null;
  onInitialize: () => void;
  onDismiss: () => void;
  onboarding?: OnboardingProgress | null;
};

export function readSetupBannerDismissed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DISMISS_KEY) === "1";
}

export function persistSetupBannerDismissed() {
  window.localStorage.setItem(DISMISS_KEY, "1");
}

export default function SchoolSetupBanner({
  loading,
  initializing,
  status,
  lastResults,
  onInitialize,
  onDismiss,
  onboarding,
}: SchoolSetupBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const systemDefaultsReady =
    Boolean(status?.initialized) &&
    (status?.departments ?? 0) > 0 &&
    (status?.permissionGroups ?? 0) > 0;

  const guide = useMemo(() => {
    const base = buildPrincipalGuide({
      systemDefaultsReady,
      hasAnnouncement: onboarding?.hasAnnouncement,
      hasEvent: onboarding?.hasEvent,
      lateRollCalls: onboarding?.lateRollCalls ?? 0,
    });
    // Mark invite step done when school already has teachers/office capacity
    // (proxy: teachers enrolled by registrar OR HT has been through staff).
    const steps = base.steps.map((step) => {
      if (step.id === "invite-registrar") {
        return {
          ...step,
          done: Boolean(
            onboarding?.hasOfficeStaff ||
              (onboarding?.teacherCount ?? 0) > 0,
          ),
          hint:
            (onboarding?.teacherCount ?? 0) > 0 || onboarding?.hasOfficeStaff
              ? "Staff path is open — keep inviting as needed"
              : step.hint,
        };
      }
      if (step.id === "defaults") {
        return { ...step, done: systemDefaultsReady };
      }
      return step;
    });
    return { ...base, steps };
  }, [systemDefaultsReady, onboarding]);

  const { done: completedCore, total: coreTotal } = countCoreProgress(
    guide.steps,
  );
  const needsAttention = !systemDefaultsReady || completedCore < coreTotal;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 sm:px-5 ${
        needsAttention
          ? "border-sky-200 bg-sky-50/70"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
            {guide.eyebrow}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {completedCore >= coreTotal
              ? "Leadership desk looks good — keep going"
              : guide.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {guide.description}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {completedCore}/{coreTotal} core steps complete
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {expanded ? (
              <>
                Hide details <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                System defaults <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
          {!systemDefaultsReady ? (
            <button
              type="button"
              onClick={onInitialize}
              disabled={initializing || loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {initializing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {status?.initialized ? "Re-run defaults" : "Apply school defaults"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-700"
            aria-label="Dismiss next steps"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {guide.steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition hover:border-slate-300 hover:bg-white ${
                step.done
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-slate-200 bg-white"
              }`}
            >
              {step.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-[10px] font-bold text-slate-400">
                  ·
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {step.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {step.hint}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SetupMetric
            label="Departments"
            value={loading ? "…" : String(status?.departments ?? 0)}
            ready={(status?.departments ?? 0) > 0}
          />
          <SetupMetric
            label="Permission groups"
            value={loading ? "…" : String(status?.permissionGroups ?? 0)}
            ready={(status?.permissionGroups ?? 0) > 0}
          />
          <SetupMetric
            label="School settings"
            value={loading ? "…" : String(status?.settings ?? 0)}
            ready={(status?.settings ?? 0) > 0}
          />
        </div>
      ) : null}

      {expanded && lastResults ? (
        <div className="mt-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">Latest defaults run</p>
          <ul className="mt-1 space-y-0.5">
            {Object.entries(lastResults).map(([key, result]) => (
              <li key={key}>
                <span className="font-medium text-slate-700">{key}</span>:{" "}
                {result.status}
                {typeof result.count === "number" ? ` (${result.count})` : ""}
                {result.error ? ` - ${result.error}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SetupMetric({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        ready
          ? "border-emerald-200 bg-emerald-50/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}
