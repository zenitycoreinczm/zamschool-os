import { ProfileField } from "@/components/teacher/dashboard/ProfileField";
import type { TeacherBootstrapData } from "@/lib/teacher-route-common";

type TeacherProfile = NonNullable<TeacherBootstrapData["teacher"]>;

type ProfileEntry = { label: string; value: string };

function buildEntries(teacher: TeacherProfile): ProfileEntry[] {
  return [
    { label: "Employee ID", value: teacher.employeeId },
    { label: "Department", value: teacher.department },
    { label: "Specialization", value: teacher.specialization },
    { label: "Hire date", value: teacher.hireDate },
    { label: "Tenure", value: teacher.tenure?.label },
    {
      label: "Classes",
      value: teacher.assignedClasses?.map((c) => c.name).join(", "),
    },
    {
      label: "Subjects",
      value: teacher.assignedSubjects?.map((s) => s.name).join(", "),
    },
    {
      label: "Supervised",
      value: teacher.supervisedClasses?.map((c) => c.name).join(", "),
    },
  ].filter((entry): entry is ProfileEntry => Boolean(entry.value));
}

export function TeacherTeachingProfile({
  teacher,
}: {
  teacher: TeacherProfile | null;
}) {
  if (!teacher) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm font-medium text-slate-500">
            Teaching profile not yet configured
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Contact your school administrator to set up your teaching assignment
            profile.
          </p>
        </div>
      </section>
    );
  }

  const entries = buildEntries(teacher);

  return (
    <section
      aria-labelledby="teacher-profile-heading"
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Your profile
      </p>
      <h2
        id="teacher-profile-heading"
        className="mt-1 text-xl font-semibold text-slate-900"
      >
        Teaching details
      </h2>
      <div className="mt-5 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 md:grid-cols-3">
        {entries.map((entry) => (
          <ProfileField
            key={entry.label}
            label={entry.label}
            value={entry.value}
          />
        ))}
      </div>
    </section>
  );
}
