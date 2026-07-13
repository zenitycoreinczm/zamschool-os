"use client";

import { AlertCircle, Loader2 } from "lucide-react";

import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import { TeacherAttentionBanner } from "@/components/teacher/dashboard/TeacherAttentionBanner";
import { TeacherAnnouncementsCard } from "@/components/teacher/dashboard/TeacherAnnouncementsCard";
import { TeacherDashboardHero } from "@/components/teacher/dashboard/TeacherDashboardHero";
import { TeacherQuickActions } from "@/components/teacher/dashboard/TeacherQuickActions";
import { TeacherTeachingProfile } from "@/components/teacher/dashboard/TeacherTeachingProfile";
import { TeacherTodaySchedule } from "@/components/teacher/dashboard/TeacherTodaySchedule";
import { TeacherWorkload } from "@/components/teacher/dashboard/TeacherWorkload";
import { useTeacherDashboardData } from "@/components/teacher/dashboard/useTeacherDashboardData";

export default function TeacherDashboard() {
  const workspace = useTeacherWorkspace();
  const {
    account,
    stats,
    workload,
    loading: workspaceLoading,
    error: workspaceError,
    displayName,
    schoolName,
    yearTerm,
    refresh: refreshWorkspace,
  } = workspace;

  const teacher = account?.teacher ?? null;

  const {
    todayLessons,
    announcements,
    loading: extraLoading,
    refreshing,
    refresh,
  } = useTeacherDashboardData(!workspaceLoading);

  if (workspaceLoading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center p-4 md:p-6"
        role="status"
        aria-live="polite"
      >
        <section className="grid w-full max-w-lg place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 shadow-sm">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-slate-500">
            Loading your workspace…
          </p>
        </section>
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="p-4 md:p-6">
        <section
          role="alert"
          className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm"
        >
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-rose-500" />
          <p className="text-sm font-medium text-rose-700">{workspaceError}</p>
          <button
            type="button"
            onClick={() => void refreshWorkspace()}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-100"
          >
            <Loader2 className="h-4 w-4" /> Try again
          </button>
        </section>
      </div>
    );
  }

  const onRefresh = () => {
    void refreshWorkspace();
    void refresh();
  };

  return (
    <div className="flex flex-col gap-5 p-4 md:gap-6 md:p-6">
      <TeacherDashboardHero
        schoolName={schoolName}
        displayName={displayName}
        yearTerm={yearTerm}
        stats={{
          lessons: stats.lessons,
          students: stats.students,
          completed: stats.completed,
          pending: stats.pending,
        }}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />

      <TeacherAttentionBanner workload={workload} />

      <TeacherQuickActions />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
        <div className="space-y-5 md:space-y-6">
          <TeacherTodaySchedule
            lessons={todayLessons}
            loading={extraLoading && !todayLessons.length}
          />
          <TeacherTeachingProfile teacher={teacher} />
        </div>
        <div className="space-y-5 md:space-y-6">
          <TeacherWorkload workload={workload} />
          <TeacherAnnouncementsCard
            announcements={announcements}
            loading={extraLoading && !announcements.length}
          />
        </div>
      </div>
    </div>
  );
}
