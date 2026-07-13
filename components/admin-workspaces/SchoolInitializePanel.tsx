"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import {
  SCHOOL_SETUP_DEPARTMENT_NAMES,
  SCHOOL_SETUP_PERMISSION_GROUP_NAMES,
  SCHOOL_SETUP_SETTING_KEYS,
  computeSchoolSetupProgress,
} from "@/lib/school-setup-catalog";

export type SchoolSetupStatus = {
  initialized: boolean;
  departments: number;
  permissionGroups: number;
  settings: number;
};

type InitResults = Record<string, { status: string; count?: number; error?: string }>;

type SchoolInitializePanelProps = {
  loading: boolean;
  initializing: boolean;
  status: SchoolSetupStatus | null;
  lastResults: InitResults | null;
  onInitialize: () => Promise<void>;
};

export default function SchoolInitializePanel({
  loading,
  initializing,
  status,
  lastResults,
  onInitialize,
}: SchoolInitializePanelProps) {
  const ctx = useWorkspaceContext() || {};
  const workspace = (ctx as any).data ?? null;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successPulse, setSuccessPulse] = useState(false);

  const progress = useMemo(
    () =>
      computeSchoolSetupProgress({
        departments: status?.departments ?? 0,
        permissionGroups: status?.permissionGroups ?? 0,
        settings: status?.settings ?? 0,
      }),
    [status]
  );

  const greetingName = workspace?.firstName?.trim() || "there";

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await onInitialize();
    setSuccessPulse(true);
    window.setTimeout(() => setSuccessPulse(false), 2400);
  };

  return (
    <>
      <section
        className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
          successPulse ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"
        }`}
      >
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-5 md:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                School initialization
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-950">
                Welcome, {greetingName}! Let&apos;s prepare {workspace?.schoolName || "your school"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                One guided setup creates default departments, permission groups, and school settings
                so you can delegate authority safely. Takes about a minute.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={initializing || loading}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {initializing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                {progress.initialized ? "Re-run setup" : "Initialize school"}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-600">
              <span>Setup completion</span>
              <span>{loading ? "…" : `${progress.percent}%`}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200/80"
              role="progressbar"
              aria-valuenow={loading ? 0 : progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-sky-600 transition-all duration-500"
                style={{ width: loading ? "8%" : `${Math.max(progress.percent, 4)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-3 md:p-6">
          <SetupMetricCard
            label="Departments"
            value={loading ? "…" : String(status?.departments ?? 0)}
            target={progress.targets.departments}
            ready={(status?.departments ?? 0) > 0}
            hint="Organizational units for staff and reporting."
          />
          <SetupMetricCard
            label="Permission groups"
            value={loading ? "…" : String(status?.permissionGroups ?? 0)}
            target={progress.targets.permissionGroups}
            ready={(status?.permissionGroups ?? 0) > 0}
            hint="Role bundles that control who can change what."
          />
          <SetupMetricCard
            label="School settings"
            value={loading ? "…" : String(status?.settings ?? 0)}
            target={progress.targets.settings}
            ready={(status?.settings ?? 0) > 0}
            hint="Portal, grading, attendance, and notification defaults."
          />
        </div>

        <div className="border-t border-slate-100 px-5 py-4 md:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            What gets created
          </p>
          <ul className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
            <li className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">{SCHOOL_SETUP_DEPARTMENT_NAMES.length} departments</span>
              <p className="mt-1 text-xs leading-5">
                e.g. {SCHOOL_SETUP_DEPARTMENT_NAMES.slice(0, 3).join(", ")}, …
              </p>
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">
                {SCHOOL_SETUP_PERMISSION_GROUP_NAMES.length} permission groups
              </span>
              <p className="mt-1 text-xs leading-5">Head Teacher, Finance, ICT, Teaching, …</p>
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <span className="font-medium text-slate-800">{SCHOOL_SETUP_SETTING_KEYS.length} settings</span>
              <p className="mt-1 text-xs leading-5">Grading, portals, MFA policy, tenant isolation.</p>
            </li>
          </ul>
        </div>

        {lastResults ? (
          <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600 md:px-6">
            <p className="font-semibold text-slate-800">Latest setup run</p>
            <ul className="mt-2 space-y-1">
              {Object.entries(lastResults).map(([key, result]) => (
                <li key={key}>
                  <span className="font-medium text-slate-700">{key}</span>: {result.status}
                  {typeof result.count === "number" ? ` (${result.count})` : ""}
                  {result.error ? ` — ${result.error}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConfirmOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="school-init-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-600">
                  Confirm setup
                </p>
                <h3 id="school-init-title" className="mt-1 text-lg font-bold text-slate-950">
                  Initialize school defaults?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              This is safe to re-run. Existing records are skipped; only missing defaults are created.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {[
                `${SCHOOL_SETUP_DEPARTMENT_NAMES.length} departments (${SCHOOL_SETUP_DEPARTMENT_NAMES.join(", ")})`,
                `${SCHOOL_SETUP_PERMISSION_GROUP_NAMES.length} permission groups for leadership, finance, ICT, HR, and teaching`,
                `${SCHOOL_SETUP_SETTING_KEYS.length} school settings (grading, portals, notifications, MFA)`,
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={initializing}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {initializing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Run setup (~1 min)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SetupMetricCard({
  label,
  value,
  target,
  ready,
  hint,
}: {
  label: string;
  value: string;
  target: number;
  ready: boolean;
  hint: string;
}) {
  return (
    <div
      className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
      title={hint}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {ready ? (
          <span className="text-[10px] font-semibold text-emerald-600">Ready</span>
        ) : (
          <span className="text-[10px] font-medium text-slate-400">Pending</span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">
        {value}
        <span className="text-base font-medium text-slate-400"> / {target}</span>
      </p>
      <p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p>
    </div>
  );
}