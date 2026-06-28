import { supabaseAdmin } from "@/lib/supabase";

export type AttendanceAnalytics = {
  attendanceRate: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  monthlyTrend: Array<{
    month: string;
    rate: number;
    present: number;
    total: number;
  }>;
};

export async function getStudentAttendanceAnalytics(input: {
  schoolId: string;
  studentId: string;
  months?: number;
}): Promise<AttendanceAnalytics> {
  const months = input.months || 3;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const start = startDate.toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await supabaseAdmin
    .from("attendance")
    .select("student_id, date, attendance_date, status, created_at")
    .eq("school_id", input.schoolId)
    .eq("student_id", input.studentId)
    .gte("date", start)
    .lte("date", end);

  if (error) throw error;

  const records = rows || [];
  const uniqueDates = new Set(
    records.map((r: any) => r.date || r.attendance_date).filter(Boolean)
  );

  const presentDays = records.filter(
    (r: any) => r.status === "present" || r.status === "PRESENT"
  ).length;
  const absentDays = records.filter(
    (r: any) => r.status === "absent" || r.status === "ABSENT"
  ).length;
  const lateDays = records.filter(
    (r: any) => r.status === "late" || r.status === "LATE"
  ).length;
  const excusedDays = records.filter(
    (r: any) => r.status === "excused" || r.status === "EXCUSED"
  ).length;

  const totalDays = uniqueDates.size;

  const monthlyMap = new Map<string, { present: number; total: number }>();
  for (const row of records) {
    const dateStr = row.date || row.attendance_date;
    if (!dateStr) continue;
    const month = dateStr.slice(0, 7);
    const entry = monthlyMap.get(month) || { present: 0, total: 1 };
    entry.total += 1;
    if (row.status === "present" || row.status === "PRESENT") {
      entry.present += 1;
    }
    monthlyMap.set(month, entry);
  }

  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      present: data.present,
      total: data.total,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    attendanceRate: totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0,
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    excusedDays,
    monthlyTrend,
  };
}

export async function getClassAttendanceSummary(input: {
  schoolId: string;
  classId: string;
  startDate: string;
  endDate: string;
}) {
  const { data: rows, error } = await supabaseAdmin
    .from("attendance")
    .select("student_id, date, attendance_date, status")
    .eq("school_id", input.schoolId)
    .eq("class_id", input.classId)
    .gte("date", input.startDate)
    .lte("date", input.endDate);

  if (error) throw error;

  const records = rows || [];
  const total = records.length;
  const present = records.filter(
    (r: any) => r.status === "present" || r.status === "PRESENT"
  ).length;
  const absent = records.filter(
    (r: any) => r.status === "absent" || r.status === "ABSENT"
  ).length;
  const late = records.filter(
    (r: any) => r.status === "late" || r.status === "LATE"
  ).length;
  const excused = records.filter(
    (r: any) => r.status === "excused" || r.status === "EXCUSED"
  ).length;

  return {
    total,
    present,
    absent,
    late,
    excused,
    attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

export function buildAttendanceColor(status: string | null | undefined): string {
  const s = String(status || "").toUpperCase().trim();
  switch (s) {
    case "PRESENT":
      return "bg-emerald-500";
    case "ABSENT":
      return "bg-rose-500";
    case "LATE":
      return "bg-amber-400";
    case "EXCUSED":
      return "bg-sky-400";
    default:
      return "bg-slate-200";
  }
}

export function buildAttendanceStatusEmoji(status: string | null | undefined): string {
  const s = String(status || "").toUpperCase().trim();
  switch (s) {
    case "PRESENT":
      return "✅";
    case "ABSENT":
      return "❌";
    case "LATE":
      return "⏰";
    case "EXCUSED":
      return "🟡";
    default:
      return "—";
  }
}
