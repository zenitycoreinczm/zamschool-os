"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { useTeacherWorkspace } from "@/components/TeacherWorkspaceProvider";
import {
  TeacherCard,
  TeacherEmptyState,
  TeacherPageHeader,
} from "@/components/teacher/TeacherWorkspaceUI";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-4">
      <TeacherPageHeader
        eyebrow="Teaching"
        title="My Classes"
        description="A clean overview of your assigned classes, subjects, and supervised classes."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AssignmentCard
          title="Assigned classes"
          description="Classes you teach (subject or timetable). You have full student access for these classes - class teacher assignment is not required."
          items={assignedClasses}
          empty="No teaching assignments yet. Once a class + subject is assigned to you, the full student roster appears here."
          href={(id) => `/app/teacher/students?class=${id}`}
        />

        <AssignmentCard
          title="Assigned subjects"
          description="Subjects you can record results and manage assessments for."
          items={assignedSubjects}
          empty="No subjects assigned yet."
          href={(id) => `/app/teacher/results?subject=${id}`}
        />
      </div>

      {supervisedClasses.length > 0 ? (
        <AssignmentCard
          title="Supervised classes"
          description="Classes where you are the class teacher or supervisor."
          items={supervisedClasses}
          empty="No supervised classes."
        />
      ) : (
        <TeacherEmptyState
          title="No supervised classes"
          description="Supervised classes will appear here once assigned by the school administrator."
        />
      )}
    </div>
  );
}

function AssignmentCard({
  title,
  description,
  items,
  empty,
  href,
}: {
  title: string;
  description: string;
  items: Array<{ id: string; name: string }>;
  empty: string;
  href?: (id: string) => string;
}) {
  return (
    <TeacherCard>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-workspace-muted">
          {description}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-workspace-muted">{empty}</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const className = cn(
              "rounded-workspace-lg border border-workspace-border bg-slate-50/80 px-3.5 py-3 text-sm font-semibold text-slate-800 shadow-workspace-xs transition hover:-translate-y-0.5 hover:bg-white hover:shadow-workspace-sm",
            );
            return href ? (
              <Link key={item.id} href={href(item.id)} className={className}>
                {item.name}
              </Link>
            ) : (
              <div key={item.id} className={className}>
                {item.name}
              </div>
            );
          })}
        </div>
      )}
    </TeacherCard>
  );
}
