import { NextResponse } from "next/server";

import { safeErrorMessage } from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_ROLES = [
  "PRINCIPAL",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "PAYMENTS",
  "DEPUTY_HEAD",
  "BURSAR",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
  "GUIDANCE_OFFICE",
  "SUPER_ADMIN",
] as const;

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: [...ALLOWED_ROLES],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    if (!classId) {
      return NextResponse.json(
        { error: "classId query parameter is required" },
        { status: 400 },
      );
    }

    const { data: classRow, error } = await supabaseAdmin
      .from("classes")
      .select("name, grade_level")
      .eq("id", classId)
      .eq("school_id", access.context.schoolId)
      .maybeSingle();

    if (error) throw error;

    let label = "";
    if (classRow?.name) {
      const parts = [
        classRow.grade_level ? `Grade ${classRow.grade_level}` : null,
        classRow.name,
      ].filter(Boolean);
      label = parts.join(" • ");
    }

    return NextResponse.json({ success: true, label });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to resolve class label") },
      { status: 500 },
    );
  }
}
