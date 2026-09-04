import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireActorContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  safeErrorMessage,
} from "@/lib/server-guards";
import { normalizeRole } from "@/lib/roles";

/**
 * Platform overview for the super admin: total schools plus per-school
 * user breakdowns (students, parents, staff, total users).
 *
 * Counts come from the canonical roster tables (students / parents) and a
 * single narrow profiles scan aggregated in memory, so role casing or
 * legacy values cannot skew the staff numbers.
 */

type SchoolRow = {
  id: string;
  name: string | null;
  code: string | null;
  status: string | null;
  created_at: string | null;
};

export async function GET(req: Request) {
  const access = await requireActorContext(
    { allowedRoles: ["SUPER_ADMIN"], requireSchool: false },
    req,
  );
  if (!access.ok) return access.response;

  const ip = getClientIp(req);
  const rate = await applyRateLimit({
    key: `super-admin-overview:${access.context.userId}:${ip}`,
    limit: 30,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data: schoolRows, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id, name, code, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (schoolError) throw schoolError;

    const schools = ((schoolRows || []) as SchoolRow[]).filter((s) => s?.id);
    const schoolIds = schools.map((s) => s.id);

    // Narrow profiles scan (2 columns, paginated) aggregated in memory.
    const staffBySchool = new Map<string, number>();
    const usersBySchool = new Map<string, number>();
    if (schoolIds.length > 0) {
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("school_id, role")
          .not("school_id", "is", null)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as Array<{
          school_id: string | null;
          role: string | null;
        }>;
        for (const row of rows) {
          const sid = String(row.school_id || "").trim();
          if (!sid) continue;
          usersBySchool.set(sid, (usersBySchool.get(sid) ?? 0) + 1);
          const role = normalizeRole(row.role);
          if (role && role !== "STUDENT" && role !== "PARENT" && role !== "SUPER_ADMIN") {
            staffBySchool.set(sid, (staffBySchool.get(sid) ?? 0) + 1);
          }
        }
        if (rows.length < pageSize) break;
      }
    }

    // Roster counts per school, chunked to bound concurrency.
    const studentsBySchool = new Map<string, number>();
    const parentsBySchool = new Map<string, number>();
    const chunkSize = 10;
    for (let i = 0; i < schoolIds.length; i += chunkSize) {
      const chunk = schoolIds.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (schoolId) => {
          const [studentsRes, parentsRes] = await Promise.all([
            supabaseAdmin
              .from("students")
              .select("id", { count: "exact", head: true })
              .eq("school_id", schoolId),
            supabaseAdmin
              .from("parents")
              .select("id", { count: "exact", head: true })
              .eq("school_id", schoolId),
          ]);
          if (studentsRes.error) throw studentsRes.error;
          if (parentsRes.error) throw parentsRes.error;
          return {
            schoolId,
            students: studentsRes.count ?? 0,
            parents: parentsRes.count ?? 0,
          };
        }),
      );
      for (const r of results) {
        studentsBySchool.set(r.schoolId, r.students);
        parentsBySchool.set(r.schoolId, r.parents);
      }
    }

    const schoolStats = schools.map((s) => ({
      id: s.id,
      name: s.name || "Unnamed school",
      code: s.code || "-",
      status: s.status || "UNKNOWN",
      created_at: s.created_at,
      students: studentsBySchool.get(s.id) ?? 0,
      parents: parentsBySchool.get(s.id) ?? 0,
      staff: staffBySchool.get(s.id) ?? 0,
      totalUsers: usersBySchool.get(s.id) ?? 0,
    }));

    const totals = schoolStats.reduce(
      (acc, s) => ({
        schools: acc.schools + 1,
        students: acc.students + s.students,
        parents: acc.parents + s.parents,
        staff: acc.staff + s.staff,
        totalUsers: acc.totalUsers + s.totalUsers,
      }),
      { schools: 0, students: 0, parents: 0, staff: 0, totalUsers: 0 },
    );

    return NextResponse.json({ success: true, data: { totals, schools: schoolStats } });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to load platform overview") },
      { status: 500 },
    );
  }
}
