import { NextResponse } from "next/server";
import {
  requireAdminContext,
  requireTeacherContext,
} from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

type AttendanceStatusKey = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export async function GET(req: Request) {
  try {
    let access = await requireAdminContext(req);
    if (!access.ok) {
      access = await requireTeacherContext(req);
    }
    if (!access.ok) return access.response;

    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school associated with this account" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "week";

    // ── Build date window ──────────────────────────────────────────────
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "month":
      case "30d":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
      case "7d":
      default: {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
    }

    const startDateIso = startDate.toISOString().slice(0, 10);
    const endDateIso = now.toISOString().slice(0, 10);

    // ── Concurrently query attendance rows, student count, and class names ──
    const [attendanceRes, studentCountRes, classesRes] = await Promise.all([
      supabaseAdmin
        .from("attendance")
        .select("id, date, status, class_id, student_id")
        .eq("school_id", schoolId)
        .gte("date", startDateIso)
        .lte("date", endDateIso)
        .order("date", { ascending: false }),
      supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("classes")
        .select("id, name")
        .eq("school_id", schoolId),
    ]);

    if (attendanceRes.error) {
      if (attendanceRes.error.code === "42P01" /* relation does not exist */) {
        const empty = NextResponse.json({
          success: true,
          data: {
            totalStudents: studentCountRes.count || 0,
            presentCount: 0,
            absentCount: 0,
            lateCount: 0,
            excusedCount: 0,
            attendanceRate: 100,
            summary: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
            recentSessions: [],
            rows: [],
          },
        });
        return applyEdgeCacheHeaders(empty, "privateRead");
      }
      throw attendanceRes.error;
    }

    const rows = attendanceRes.data || [];
    const classNameMap = new Map<string, string>();
    for (const c of classesRes.data || []) {
      classNameMap.set(c.id, c.name);
    }

    // ── Calculate breakdowns ─────────────────────────────────────────
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;

    // Grouping for recent sessions
    const sessionsMap = new Map<
      string,
      {
        id: string;
        date: string;
        className: string;
        present: number;
        absent: number;
        late: number;
        excused: number;
      }
    >();

    for (const row of rows) {
      const rawStatus = String(row.status || "").trim().toUpperCase();
      let statusKey: AttendanceStatusKey = "ABSENT";
      if (rawStatus === "PRESENT") {
        statusKey = "PRESENT";
        presentCount++;
      } else if (rawStatus === "LATE") {
        statusKey = "LATE";
        lateCount++;
      } else if (rawStatus === "EXCUSED" || rawStatus === "SICK") {
        statusKey = "EXCUSED";
        excusedCount++;
      } else {
        statusKey = "ABSENT";
        absentCount++;
      }

      if (row.class_id && row.date) {
        const sessionKey = `${row.date}_${row.class_id}`;
        let session = sessionsMap.get(sessionKey);
        if (!session) {
          session = {
            id: sessionKey,
            date: String(row.date).slice(0, 10),
            className: classNameMap.get(row.class_id) || "Class session",
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
          };
          sessionsMap.set(sessionKey, session);
        }
        if (statusKey === "PRESENT") session.present++;
        else if (statusKey === "LATE") session.late++;
        else if (statusKey === "EXCUSED") session.excused++;
        else session.absent++;
      }
    }

    const totalMarks = presentCount + absentCount + lateCount + excusedCount;
    const presentLike = presentCount + lateCount + excusedCount;
    const attendanceRate =
      totalMarks > 0 ? Math.round((presentLike / totalMarks) * 100) : 100;

    const recentSessions = Array.from(sessionsMap.values()).slice(0, 15);

    const response = NextResponse.json({
      success: true,
      data: {
        totalStudents: studentCountRes.count || 0,
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        attendanceRate,
        summary: {
          PRESENT: presentCount,
          ABSENT: absentCount,
          LATE: lateCount,
          EXCUSED: excusedCount,
        },
        recentSessions,
        rows,
      },
    });

    return applyEdgeCacheHeaders(response, "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load attendance summary") },
      { status: 500 },
    );
  }
}
