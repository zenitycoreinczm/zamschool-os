import { NextResponse } from "next/server";

import { buildAttendanceWindow, summarizeAttendance } from "@/lib/attendance/summary";
import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, getClassesById, buildClassLabel, buildDisplayName } from "@/lib/parent-route-utils";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const selectedStudentId = searchParams.get("studentId");
    const { range, startDate, endDate } = buildAttendanceWindow(
      searchParams.get("range"),
      searchParams.get("endDate")
    );

    const parentRecord = await getParentRecord({ profileId: userId, schoolId });

    if (!parentRecord) {
      return jsonResponse({
        success: true,
        data: { range, startDate, endDate, summary: summarizeAttendance([]), children: [], rows: [] },
      });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: userId,
      schoolId,
      fallbackRelationship: parentRecord.relation_type || null,
      includeRowMappings: true,
    });

    if (linked.profileIds.length === 0) {
      return jsonResponse({
        success: true,
        data: { range, startDate, endDate, summary: summarizeAttendance([]), children: [], rows: [] },
      });
    }

    if (selectedStudentId && !linked.profileIds.includes(selectedStudentId)) {
      return NextResponse.json(
        { error: "Requested child is not linked to this parent account" },
        { status: 403 }
      );
    }

    const scopedProfileIds = selectedStudentId ? [selectedStudentId] : linked.profileIds;
    const scopedStudentRowIds = scopedProfileIds
      .map((profileId) => linked.studentRowIdByProfileId?.get(profileId))
      .filter(Boolean) as string[];

    if (scopedProfileIds.length === 0) {
      return jsonResponse({
        success: true,
        data: {
          range,
          startDate,
          endDate,
          summary: summarizeAttendance([]),
          children: [],
          rows: [],
        },
      });
    }

    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, first_name, last_name, email")
      .eq("school_id", schoolId)
      .in("id", scopedProfileIds)
      .order("first_name", { ascending: true });

    if (studentError) throw studentError;

    const classIds = Array.from(
      new Set(
        scopedProfileIds
          .map((profileId) => linked.classIdByProfileId.get(profileId))
          .filter(Boolean)
      )
    ) as string[];

    const classesById = await getClassesById(schoolId, classIds);

    // Empty `.in()` filters error in PostgREST - skip attendance query when
    // we only have profile ids and no students-row mappings.
    let attendanceRows: any[] = [];
    if (scopedStudentRowIds.length > 0) {
      const attendanceResult = await supabaseAdmin
        .from("attendance")
        .select(
          "id, student_id, class_id, date, attendance_date, status, remarks, notes, recorded_by, session_name, session_time, created_at"
        )
        .eq("school_id", schoolId)
        .in("student_id", scopedStudentRowIds)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (attendanceResult.error) throw attendanceResult.error;
      attendanceRows = attendanceResult.data || [];
    }

    const recordedByIds = Array.from(
      new Set(attendanceRows.map((row: any) => row.recorded_by).filter(Boolean))
    );
    const teachersById = await getProfilesById(schoolId, recordedByIds);
    const studentsById = new Map((studentRows || []).map((row: any) => [row.id, row]));
    const studentProfileIdByStudentRowId = linked.profileIdByStudentRowId;

    const rows = attendanceRows.flatMap((row: any) => {
      const studentProfileId = studentProfileIdByStudentRowId?.get(row.student_id);
      if (!studentProfileId) return [];

      const student = studentsById.get(studentProfileId);
      const classId = linked.classIdByProfileId.get(studentProfileId) || row.class_id || null;

      return [{
        id: row.id,
        date: row.date || row.attendance_date,
        status: normalizeAttendanceStatus(row.status),
        remarks: row.remarks || row.notes || null,
        studentId: studentProfileId,
        studentName: buildDisplayName(student),
        lessonId: null,
        classId: classesById.get(classId || "")?.id || classId || null,
        className: buildClassLabel(classesById.get(classId || "")),
        teacherId: row.recorded_by || null,
        teacherName: buildDisplayName(teachersById.get(row.recorded_by || "")),
        subjectName: row.session_name || "Attendance",
        subjectCode: null,
        startTime: row.session_time || null,
        endTime: null,
        room: null,
      }];
    });

    const children = (studentRows || []).map((student: any) => {
      const childRows = rows.filter((row: any) => row.studentId === student.id);
      return {
        id: student.id,
        displayName: buildDisplayName(student),
        admissionNumber: linked.studentNumberByProfileId?.get(student.id) || null,
        classId: linked.classIdByProfileId.get(student.id) || null,
        className: buildClassLabel(
          classesById.get(linked.classIdByProfileId.get(student.id) || "")
        ),
        relationship:
          linked.relationshipByProfileId.get(student.id) || parentRecord.relation_type || null,
        summary: summarizeAttendance(childRows),
      };
    });

    return jsonResponse({
      success: true,
      data: { range, startDate, endDate, summary: summarizeAttendance(rows), children, rows },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent attendance") },
      { status: 500 }
    );
  }
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "noStore");
}

async function getProfilesById(schoolId: string, profileIds: string[]) {
  if (profileIds.length === 0) return new Map<string, any>();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("school_id", schoolId)
    .in("id", profileIds);
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

function normalizeAttendanceStatus(status: string | null | undefined) {
  const normalized = String(status || "").trim().toUpperCase();
  if (["PRESENT", "ABSENT", "LATE", "EXCUSED"].includes(normalized)) {
    return normalized;
  }
  return "ABSENT";
}
