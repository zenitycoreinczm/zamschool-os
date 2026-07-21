"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import Announcements from "@/components/Announcements";
import { AssignmentSubmissionDialog } from "@/components/student/dashboard/AssignmentSubmissionDialog";
import { StudentStudyTips } from "@/components/student/dashboard/StudentStudyTips";
import { StudentAttendanceStats } from "@/components/student/dashboard/StudentAttendanceStats";
import { StudentDashboardHero } from "@/components/student/dashboard/StudentDashboardHero";
import { StudentPublishedResults } from "@/components/student/dashboard/StudentPublishedResults";
import { StudentTodayLessons } from "@/components/student/dashboard/StudentTodayLessons";
import { StudentUpcomingAssignments } from "@/components/student/dashboard/StudentUpcomingAssignments";
import RoleSetupGuide, {
  persistGuideDismissed,
  readGuideDismissed,
} from "@/components/workspace/RoleSetupGuide";
import { getEmptyAttendanceSummary } from "@/components/student/dashboard/format";
import type { StudentAssignmentRow } from "@/components/student/dashboard/types";
import { buildStudentGuide } from "@/lib/workspace/role-onboarding";
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
  const [guideDismissed, setGuideDismissed] = useState(true);

  const summary = dashboard?.attendance.summary || getEmptyAttendanceSummary();
  const className = dashboard?.profile.className || "Class pending";
  const classNumber = dashboard?.profile.classNumber ?? null;

  useEffect(() => {
    setGuideDismissed(readGuideDismissed("zamschool.guide.student.dismissed"));
  }, []);
  const guide = useMemo(
    () =>
      buildStudentGuide({
        hasResults: (results?.length ?? 0) > 0,
        hasAbsences: Number(summary?.ABSENT ?? 0) > 0,
      }),
    [results, summary],
  );
  const showGuide =
    !guideDismissed &&
    ((results?.length ?? 0) === 0 || Number(summary?.ABSENT ?? 0) > 0);

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

      {showGuide ? (
        <RoleSetupGuide
          guide={guide}
          onDismiss={() => {
            persistGuideDismissed(guide.storageKey);
            setGuideDismissed(true);
          }}
        />
      ) : null}

      {dashboard?.schoolDayHours?.classesStartAt ? (
        <section className="rounded-2xl border border-violet-100 bg-violet-50/70 px-4 py-3.5 text-sm text-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-violet-900">
                School day · don&apos;t be late
              </p>
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
                      {String(dashboard.schoolDayHours.schoolOpensAt).slice(0, 5)}{" "}
                      –{" "}
                      {String(
                        dashboard.schoolDayHours.schoolClosesAt ||
                          dashboard.schoolDayHours.classesEndAt ||
                          "",
                      ).slice(0, 5)}
                    </span>
                  </>
                ) : null}
                .
              </p>
            </div>
          </div>
          <ul className="mt-2.5 space-y-1 text-xs text-violet-950/80">
            <li>
              · Phone reminders: ~1h 30m before start, then again ~1h before
              (don&apos;t run late).
            </li>
            <li>
              · Each lesson: 5 minutes before class so you can get to the right
              room.
            </li>
            {(dashboard.schoolDayHours.morningReminders || [])
              .slice(0, 3)
              .map((slot: { fireAt?: string; label?: string; title?: string }) => (
                <li key={`${slot.fireAt}-${slot.label}`}>
                  · Today:{" "}
                  <span className="font-semibold tabular-nums">
                    {String(slot.fireAt || "").slice(0, 5)}
                  </span>
                  {slot.label ? ` (${slot.label} left)` : ""} —{" "}
                  {slot.title || "Get ready"}
                </li>
              ))}
          </ul>
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
          <StudentStudyTips />
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
