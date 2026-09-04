"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, X } from "lucide-react";
import type { RoleOnboardingGuide } from "@/lib/workspace/role-onboarding";
import { countCoreProgress } from "@/lib/workspace/role-onboarding";

type RoleSetupGuideProps = {
  guide: RoleOnboardingGuide;
  onDismiss: () => void;
  /** Optional footer (e.g. system defaults for principal) */
  footer?: React.ReactNode;
};

export function readGuideDismissed(storageKey: string) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function persistGuideDismissed(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // ignore storage access errors (private mode / restricted sandbox)
  }
}

/**
 * React 19 clean hook for guide dismissal without cascading effect re-renders
 */
export function useGuideDismissed(storageKey: string) {
  const [dismissed, setDismissed] = useState(() => readGuideDismissed(storageKey));

  const dismiss = () => {
    persistGuideDismissed(storageKey);
    setDismissed(true);
  };

  const reopen = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore storage access errors (private mode / restricted sandbox)
    }
    setDismissed(false);
  };

  return [dismissed, dismiss, reopen] as const;
}

export default function RoleSetupGuide({
  guide,
  onDismiss,
  footer,
}: RoleSetupGuideProps) {
  const [expanded, setExpanded] = useState(false);
  const { done, total } = countCoreProgress(guide.steps);
  const needsAttention = done < total;

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
            {done >= total ? "You’re on track — keep going" : guide.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {guide.description}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {done}/{total} core steps complete
          </p>
          <div
            className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-200/80"
            role="progressbar"
            aria-label={`${guide.eyebrow}: core setup progress`}
            aria-valuetext={`${done} of ${total} core steps complete`}
            aria-valuenow={done}
            aria-valuemin={0}
            aria-valuemax={total}
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{
                width: `${total > 0 ? Math.round((done / total) * 100) : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {footer ? (
            <button
              type="button"
              onClick={() => setExpanded((c) => !c)}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              aria-expanded={expanded}
              aria-controls="role-setup-guide-details"
            >
              {expanded ? (
                <>
                  Hide details <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  More <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label="Dismiss guide"
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

      {expanded && footer ? (
        <div id="role-setup-guide-details" className="mt-3">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
