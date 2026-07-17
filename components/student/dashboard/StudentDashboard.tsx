"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import Announcements from "@/components/Announcements";
import { AssignmentSubmissionDialog } from "@/components/student/dashboard/AssignmentSubmissionDialog";
import { StudentAttendanceStats } from "@/components/student/dashboard/StudentAttendanceStats";
import { StudentDashboardHero } from "@/components/student/dashboard/StudentDashboardHero";
import { StudentPublishedResults } from "@/components/student/dashboard/StudentPublishedResults";
import { StudentTodayLessons } from "@/components/student/dashboard/StudentTodayLessons";
import { StudentUpcomingAssignments } from "@/components/student/dashboard/StudentUpcomingAssignments";
import { getEmptyAttendanceSummary } from "@/components/student/dashboard/format";
import type { StudentAssignmentRow } from "@/components/student/dashboard/types";
import { useStudentDashboard } from "@/components/student/dashboard/useStudentDashboard";

export default function StudentDashboard() {
  const {
    dashboard,
    results,
    loading,
    refreshing,
    error,
    refresh,
    submitAssignment,
  } = useStudentDashboard();

  const [selectedAssignment, setSelectedAssignment] =
    useState<StudentAssignmentRow | null>(null);

  const openSubmissionDialog = (assignment: StudentAssignmentRow) => {
    setSelectedAssignment(assignment);
  };

  const closeSubmissionDialog = () => {
    setSelectedAssignment(null);
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6" role="status" aria-live="polite">
        <section className="grid place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-16 text-sm text-slate-500 shadow-sm">
          <Loader2 className="mb-3 h-5 w-5 animate-spin text-slate-500" />
          Loading your dashboard…
        </section>
      </div>
    );
  }

  const summary = dashboard?.attendance.summary || getEmptyAttendanceSummary();
  const className = dashboard?.profile.className || "Class pending";
  const classNumber = dashboard?.profile.classNumber ?? null;

  return (
    <div className="flex-1 space-y-5 p-4 md:space-y-6 md:p-6">
      <StudentDashboardHero
        className={className}
        classNumber={classNumber}
        refreshing={refreshing}
        error={error}
        onRefresh={() => void refresh()}
        assignmentCount={dashboard?.assignments.total}
        urgentCount={dashboard?.assignments.urgent}
      />

      {dashboard?.schoolDayHours?.classesStartAt ? (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-violet-900">School day</p>
          <p className="mt-1 text-slate-600">
            Classes run{" "}
            <span className="font-semibold tabular-nums text-slate-900">
              {String(dashboard.schoolDayHours.classesStartAt).slice(0, 5)} –{" "}
              {String(dashboard.schoolDayHours.classesEndAt || "").slice(0, 5)}
            </span>
            {dashboard.schoolDayHours.schoolOpensAt ? (
              <>
                {" "}
                · campus open{" "}
                <span className="tabular-nums">
                  {String(dashboard.schoolDayHours.schoolOpensAt).slice(0, 5)} –{" "}
                  {String(
                    dashboard.schoolDayHours.schoolClosesAt ||
                      dashboard.schoolDayHours.classesEndAt ||
                      "",
                  ).slice(0, 5)}
                </span>
              </>
            ) : null}
            . Morning reminders on the mobile app use these times.
          </p>
        </section>
      ) : null}

      <StudentAttendanceStats summary={summary} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
        <div className="space-y-5 md:space-y-6">
          <StudentTodayLessons lessons={dashboard?.todayLessons || []} />

          <StudentUpcomingAssignments
            assignments={dashboard?.assignments.rows || []}
            onSubmit={openSubmissionDialog}
          />

          <StudentPublishedResults results={results} />
        </div>

        <div className="space-y-5 md:space-y-6">
          <Announcements />
        </div>
      </div>

      <AssignmentSubmissionDialog
        assignment={selectedAssignment}
        onClose={closeSubmissionDialog}
        onSaved={() =>
          submitAssignment(selectedAssignment as StudentAssignmentRow)
        }
      />
    </div>
  );
}
