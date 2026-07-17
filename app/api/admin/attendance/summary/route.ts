import { NextResponse } from "next/server";
import {
  requireAdminContext,
  requireTeacherContext,
} from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

type AttendanceRow = {
  date: string;
  status: string;
};

export async function GET(req: Request) {
  try {
    // School office roles (Guidance, Deputy Head, Discipline, etc.) + teachers.
    // Previously a hard-coded role list omitted GUIDANCE_OFFICE → Forbidden.
    let access = await requireAdminContext(req);
    if (!access.ok) {
      access = await requireTeacherContext(req);
    }
    if (!access.ok) return access.response;

    const { schoolId } = access.context;

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "week";

    // ── Build date window ──────────────────────────────────────────────
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "week":
      default: {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        startDate = new Date(now);
        startDate.setDate(now.getDate() + diffToMonday);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
    }

    // ── Query attendance records ───────────────────────────────────────
    const { data: rows, error } = await supabaseAdmin
      .from("attendance")
      .select("date, status")
      .eq("school_id", schoolId)
      .gte("date", startDate.toISOString())
      .lte("date", now.toISOString())
      .order("date", { ascending: true });

    if (error) {
      // Table may not exist yet - return empty gracefully
      if (error.code === "42P01" /* relation does not exist */) {
        const empty = NextResponse.json({
          success: true,
          data: { rows: [] as AttendanceRow[] },
        });
        return applyEdgeCacheHeaders(empty, "privateRead");
      }
      throw error;
    }

    const response = NextResponse.json({
      success: true,
      data: { rows: rows || [] },
    });
    return applyEdgeCacheHeaders(response, "privateRead");
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load attendance summary") },
      { status: 500 },
    );
  }
}
