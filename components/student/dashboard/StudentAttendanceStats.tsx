import { StudentStatCard } from "@/components/student/dashboard/StudentStatCard";
import type { StudentAttendanceSummary } from "@/components/student/dashboard/types";

export function StudentAttendanceStats({
  summary,
}: {
  summary: StudentAttendanceSummary;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StudentStatCard
        label="Present"
        value={String(summary.PRESENT)}
        tone="emerald"
      />
      <StudentStatCard
        label="Absent"
        value={String(summary.ABSENT)}
        tone="rose"
      />
      <StudentStatCard label="Late" value={String(summary.LATE)} tone="amber" />
      <StudentStatCard
        label="Attendance Rate"
        value={`${summary.rate}%`}
        tone="sky"
      />
    </div>
  );
}
