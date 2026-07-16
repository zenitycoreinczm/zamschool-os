"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal } from "lucide-react";
import { isAbortLikeError } from "@/lib/async-guards";
import { fetchDashboardSummary } from "@/lib/dashboard-client";
import { useDashboardSummary } from "@/components/DashboardSummaryProvider";
import { roleStatSurface, ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";
import { AcademicContextLabel } from "@/components/workspace/AcademicContextLabel";

type UserCardType = keyof typeof roleStatSurface;

/** Display labels - never show legacy "admins" for Head Teacher / office leadership. */
const ROLE_CARD_LABELS: Record<UserCardType, string> = {
  admin: "Leadership",
  teacher: "Teachers",
  student: "Students",
  parent: "Parents",
};

/**
 * Where each card navigates. Head Teacher does not use the people directory
 * (`/app/admin/users`); office leadership and teachers go to Invite staff.
 * Students/parents are Registrar work - cards stay informational for HT.
 */
const PRINCIPAL_CARD_HREFS: Record<UserCardType, string | null> = {
  admin: "/app/principal/staff",
  teacher: "/app/principal/staff",
  student: null,
  parent: null,
};

const DIRECTORY_CARD_HREFS: Record<UserCardType, string> = {
  admin: "/app/hr-admin/directory",
  teacher: "/app/hr-admin/directory",
  student: "/app/registrar/people?role=student",
  parent: "/app/registrar/people?role=parent",
};

export type UserCardPeopleMode = "directory" | "principal";

export default function UserCard({
  type,
  peopleMode = "directory",
}: {
  type: UserCardType;
  /** Head Teacher: no Users directory. Default keeps registrar/HR directory links. */
  peopleMode?: UserCardPeopleMode;
}) {
  const [fallbackSummary, setFallbackSummary] = useState<
    NonNullable<ReturnType<typeof useDashboardSummary>>["summary"] | null
  >(null);
  const router = useRouter();
  const dashboard = useDashboardSummary();
  const summary = dashboard?.summary ?? fallbackSummary;
  const count = summary?.roleCounts[type] ?? null;
  const academicLabel = summary?.academicLabel ?? "Current term";
  const loading = !summary && (dashboard?.loading ?? true);
  const label = ROLE_CARD_LABELS[type];
  const href =
    peopleMode === "principal"
      ? PRINCIPAL_CARD_HREFS[type]
      : DIRECTORY_CARD_HREFS[type];
  const interactive = Boolean(href);

  const handleClick = () => {
    if (!href) return;
    router.push(href);
  };

  useEffect(() => {
    if (dashboard?.summary || dashboard?.loading) {
      return;
    }

    let cancelled = false;

    const fetchCount = async () => {
      try {
        const nextSummary = await fetchDashboardSummary();
        if (cancelled) return;
        setFallbackSummary(nextSummary);
      } catch (err) {
        if (cancelled || isAbortLikeError(err)) return;
        console.error(`Error fetching ${type} count:`, err);
        setFallbackSummary({
          schoolId: "",
          academicLabel: "Current term",
          roleCounts: { admin: 0, teacher: 0, student: 0, parent: 0 },
          studentTotals: { total: 0, boys: 0, girls: 0, unspecified: 0 },
        });
      }
    };

    void fetchCount();

    return () => {
      cancelled = true;
    };
  }, [type, dashboard?.summary, dashboard?.loading]);

  const surfaceClass = cn(
    "group ws-card-glow min-w-[8.125rem] rounded-workspace-xl border bg-gradient-to-br p-4 text-left shadow-workspace-sm relative overflow-hidden backdrop-blur-sm",
    roleStatSurface[type],
    interactive &&
      "ws-hover-lift cursor-pointer focus-visible:shadow-workspace-focus",
    !interactive && "cursor-default",
  );

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex max-w-[10.5rem] items-baseline gap-1 truncate rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold text-slate-800 shadow-2xs ring-1 ring-black/5">
          <AcademicContextLabel
            value={academicLabel}
            yearClassName="text-[10px] font-semibold text-slate-800"
            termClassName="text-[9px] font-medium uppercase tracking-[0.1em] text-slate-500"
          />
        </span>
        {interactive ? (
          <span
            className="text-slate-500/80 transition group-hover:scale-110 group-hover:text-slate-900"
            aria-hidden
          >
            <MoreHorizontal className="h-5 w-5" />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-4 text-[2rem] font-bold leading-none tracking-tight text-slate-900",
          ws.tabular,
        )}
      >
        {loading ? (
          <Loader2
            className="h-7 w-7 animate-spin text-slate-400"
            aria-label="Loading count"
          />
        ) : (
          (count ?? 0).toLocaleString()
        )}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        {interactive ? (
          <span className="text-[11px] font-medium text-slate-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            View &rarr;
          </span>
        ) : null}
      </div>
    </>
  );

  if (!interactive) {
    return <div className={surfaceClass}>{body}</div>;
  }

  return (
    <button type="button" onClick={handleClick} className={surfaceClass}>
      {body}
    </button>
  );
}
