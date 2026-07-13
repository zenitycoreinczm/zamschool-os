"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
  TeacherStatCard,
} from "@/components/teacher/TeacherWorkspaceUI";
import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import type { LessonRow } from "@/components/teacher/dashboard/types";
import { adminApiJson } from "@/lib/admin-browser-api";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";

function localDateInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function shiftDate(isoDate: string, deltaDays: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return localDateInput(d);
}

export default function TeacherTeachingPage() {
  const { account, stats, yearTerm } = useTeacherWorkspace();
  const [date, setDate] = useState(localDateInput());
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (selectedDate: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const body = await adminApiJson<{ success?: boolean; data?: LessonRow[] }>(
        `/api/teacher/classes?date=${encodeURIComponent(selectedDate)}&limit=40`,
      );
      setLessons(Array.isArray(body.data) ? body.data : []);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load schedule",
      );
      setLessons([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const assignedClasses = account?.teacher?.assignedClasses ?? [];
  const assignedSubjects = account?.teacher?.assignedSubjects ?? [];
  const totalRoster = lessons.reduce((sum, lesson) => sum + (lesson.rosterCount || 0), 0);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <TeacherPageHeader
        eyebrow="Teaching"
        title="Schedule"
        description={`Your lessons for ${yearTerm}. Pick a day, open attendance, or jump into a class roster.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load(date, true)}
              disabled={refreshing}
              className={secondaryButton()}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </button>
            <Link href="/app/teacher/attendance" className={primaryButton()}>
              Take attendance
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TeacherStatCard label="Lessons this day" value={lessons.length} />
        <TeacherStatCard label="Students on roster" value={totalRoster} />
        <TeacherStatCard label="Classes assigned" value={assignedClasses.length} />
        <TeacherStatCard label="Subjects" value={assignedSubjects.length} />
      </div>

      <TeacherCard className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Day board</h2>
            <p className="mt-1 text-sm text-workspace-muted">
              Lessons scheduled for the selected date from your timetable.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              className={secondaryButton("px-3 py-2")}
              onClick={() => setDate(shiftDate(date, -1))}
            >
              Previous
            </button>
            <button
              type="button"
              className={secondaryButton("px-3 py-2")}
              onClick={() => setDate(localDateInput())}
            >
              Today
            </button>
            <button
              type="button"
              className={secondaryButton("px-3 py-2")}
              onClick={() => setDate(shiftDate(date, 1))}
            >
              Next
            </button>
            <div className="min-w-[12rem]">
              <DateOnlyPicker
                label="Date"
                value={date}
                onChange={setDate}
                accent="slate"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-14 text-center">
            <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
            <p className="text-sm text-workspace-muted">Loading schedule…</p>
          </div>
        ) : lessons.length === 0 ? (
          <TeacherEmptyState
            title="No lessons on this day"
            description="If you expected lessons, ask academic admin to assign your timetable slots."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {lesson.subjectName}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {lesson.className}
                    </p>
                  </div>
                  <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
                <p className="mt-3 text-xs font-medium text-slate-500">
                  {(lesson.startTime || "").slice(0, 5)} –{" "}
                  {(lesson.endTime || "").slice(0, 5)}
                  {lesson.rosterCount
                    ? ` · ${lesson.rosterCount} students`
                    : ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/app/teacher/attendance?date=${encodeURIComponent(lesson.date || date)}`}
                    className={secondaryButton("px-3 py-2 text-xs")}
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Attendance
                  </Link>
                  <Link
                    href={`/app/teacher/students?class=${encodeURIComponent(lesson.classId)}`}
                    className={secondaryButton("px-3 py-2 text-xs")}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Roster
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </TeacherCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <TeacherCard>
          <h2 className="text-sm font-semibold text-slate-900">Your classes</h2>
          <p className="mt-1 text-sm text-workspace-muted">
            Jump to rosters for classes linked to your teaching load.
          </p>
          {assignedClasses.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No classes assigned yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {assignedClasses.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/app/teacher/students?class=${cls.id}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-white"
                >
                  {cls.name}
                </Link>
              ))}
            </div>
          )}
        </TeacherCard>

        <TeacherCard>
          <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
          <div className="mt-4 grid gap-2">
            {[
              {
                href: "/app/teacher/assignments",
                label: "Assignments",
                desc: "Homework and classwork",
              },
              {
                href: "/app/teacher/results",
                label: "Results",
                desc: "Scores and grade entry",
              },
              {
                href: "/app/teacher/discipline",
                label: "Conduct",
                desc: "Behaviour notes",
              },
              {
                href: "/app/teacher/classes",
                label: "My classes overview",
                desc: "Assignments and supervision",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 px-3.5 py-3 transition hover:bg-slate-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-slate-900">
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500">{item.desc}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </TeacherCard>
      </div>

      {/* Keep a subtle stats footer for workspace context without a second hero. */}
      <p className="text-center text-xs text-slate-400">
        Workspace snapshot · {stats.lessons} lessons · {stats.students} students
        · {stats.pending} pending actions
      </p>
    </div>
  );
}
