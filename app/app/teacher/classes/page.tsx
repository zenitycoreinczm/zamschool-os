"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";

import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import {
  TeacherCard,
  TeacherPageHeader,
  TeacherStatCard,
} from "@/components/teacher/TeacherWorkspaceUI";

export default function TeacherClassesPage() {
  const { account, loading, error } = useTeacherWorkspace();

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center p-4 md:p-6">
        <TeacherCard className="grid w-full max-w-lg place-items-center py-14 text-center">
          <Loader2 className="mb-3 h-6 w-6 animate-spin text-slate-500" />
          <p className="text-sm font-medium text-workspace-muted">
            Loading your classes…
          </p>
        </TeacherCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <TeacherCard className="mx-auto max-w-lg text-center">
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </TeacherCard>
      </div>
    );
  }

  const assignedClasses = account?.teacher?.assignedClasses ?? [];
  const assignedSubjects = account?.teacher?.assignedSubjects ?? [];
  const supervisedClasses = account?.teacher?.supervisedClasses ?? [];
  const supervisedIds = new Set(supervisedClasses.map((c) => c.id));

  return (
    <div className="flex flex-col gap-5 pb-6">
      <TeacherPageHeader
        eyebrow="Teaching"
        title="My Classes"
        description="Quick access to your assigned classes, subject rosters, and attendance."
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TeacherStatCard
          label="Assigned classes"
          value={assignedClasses.length}
          hint="Classes you teach"
        />
        <TeacherStatCard
          label="Subjects"
          value={assignedSubjects.length}
          hint="Assessment & grading"
        />
        <TeacherStatCard
          label="Supervised"
          value={supervisedClasses.length}
          hint="Class teacher role"
        />
      </div>

      {/* Assigned Classes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Assigned classes</h2>
            <p className="text-xs text-slate-500">
              Classes where you conduct lessons or take roll call.
            </p>
          </div>
        </div>

        {assignedClasses.length === 0 ? (
          <TeacherCard className="py-10 text-center text-sm text-slate-500">
            No classes assigned yet. Contact your school administrator to set up your timetable.
          </TeacherCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assignedClasses.map((cls) => {
              const isSupervisor = supervisedIds.has(cls.id);

              return (
                <div
                  key={cls.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                          <GraduationCap className="h-4 w-4" />
                        </span>
                        <h3 className="font-bold text-slate-900">{cls.name}</h3>
                      </div>
                      {isSupervisor ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          <ShieldCheck className="h-3 w-3" />
                          Supervisor
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/app/teacher/students?class=${cls.id}`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Roster
                    </Link>
                    <Link
                      href="/app/teacher/attendance"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      Attendance
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Assigned Subjects */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-950">Assigned subjects</h2>
          <p className="text-xs text-slate-500">
            Subjects you manage assessments, continuous assessment (CA), and exam marks for.
          </p>
        </div>

        {assignedSubjects.length === 0 ? (
          <TeacherCard className="py-8 text-center text-sm text-slate-500">
            No subjects assigned yet.
          </TeacherCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assignedSubjects.map((subject) => (
              <Link
                key={subject.id}
                href={`/app/teacher/results?subject=${subject.id}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                    <BookOpen className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{subject.name}</p>
                    <p className="text-xs text-slate-500">Record results</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
