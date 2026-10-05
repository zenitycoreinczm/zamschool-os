"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  CreditCard,
  GraduationCap,
  Layers,
  Loader2,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { adminApiJson } from "@/lib/admin-browser-api";
import { cn } from "@/lib/utils";
import type { OnboardingData, OnboardingStep } from "@/app/api/admin/onboarding/route";

const STEP_ICONS: Record<OnboardingStep["id"], typeof Calendar> = {
  terms: Calendar,
  classes: Building2,
  subjects: BookOpen,
  staff: Users,
  students: GraduationCap,
  fees: CreditCard,
};

export function SchoolOnboardingChecklist() {
  const [data, setData] = useState<OnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const loadStatus = useCallback(async () => {
    try {
      const res = await adminApiJson<{ success: boolean; data: OnboardingData }>(
        "/api/admin/onboarding",
      );
      if (res?.data) {
        setData(res.data);
        // If 100% complete, default to collapsed
        if (res.data.isComplete) {
          setExpanded(false);
        }
      }
    } catch {
      // Fail silently if not in admin context
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (loading || !data) {
    return null;
  }

  const { completedSteps, totalSteps, percentComplete, isComplete, nextStep, steps } = data;

  return (
    <div
      className={cn(
        "rounded-2xl border transition shadow-sm overflow-hidden",
        isComplete
          ? "border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white"
          : "border-sky-200 bg-gradient-to-br from-sky-50/50 via-white to-white",
      )}
    >
      {/* Header Bar */}
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm",
              isComplete
                ? "bg-emerald-100 text-emerald-700"
                : "bg-sky-100 text-sky-700",
            )}
          >
            {isComplete ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                {isComplete
                  ? "School Setup Complete"
                  : "Guided School Onboarding"}
              </h3>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  isComplete
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-sky-100 text-sky-800",
                )}
              >
                {completedSteps} of {totalSteps} Steps Complete ({percentComplete}%)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isComplete
                ? "Your academic terms, classes, curriculum, staff, students, and fees are operational."
                : "Follow this setup guide to initialize your school terms, classes, subjects, staff, and fees."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isComplete && nextStep && (
            <Link
              href={nextStep.href}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 transition"
            >
              Next: {nextStep.title}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 transition cursor-pointer"
            aria-label={expanded ? "Collapse setup checklist" : "Expand setup checklist"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500",
            isComplete ? "bg-emerald-500" : "bg-sky-500",
          )}
          style={{ width: `${percentComplete}%` }}
        />
      </div>

      {/* Expandable Steps Grid */}
      {expanded && (
        <div className="p-5 bg-white/70">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, idx) => {
              const Icon = STEP_ICONS[step.id] || Layers;
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl border p-4 transition duration-150",
                    step.done
                      ? "border-emerald-200/80 bg-emerald-50/30"
                      : "border-slate-200 bg-white hover:border-sky-300 hover:shadow-2xs",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                            step.done
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {idx + 1}. {step.title}
                        </span>
                      </div>
                      {step.done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Done
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                      {step.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100/80 text-xs">
                    <span className="font-semibold text-slate-600 text-[11px]">
                      {step.label}
                    </span>
                    <Link
                      href={step.href}
                      className={cn(
                        "inline-flex items-center gap-1 font-bold text-xs transition",
                        step.done
                          ? "text-slate-600 hover:text-slate-900"
                          : "text-sky-600 hover:text-sky-700",
                      )}
                    >
                      {step.actionText} →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
