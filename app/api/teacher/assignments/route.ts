import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveTeachersTableId } from "@/lib/live-schema-adapters";
import { teacherHasClassAccess } from "@/lib/teacher-assignment-scope";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import { validateTeacherManagedAssignmentTarget } from "@/lib/teacher-assignment-contract";
import { requireTeacherContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";

// Schema for assignment validation
const assignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  class_id: z.string().uuid("Valid class ID is required"),
  subject_id: z.string().uuid("Valid subject ID is required"),
  // Accept date-only (YYYY-MM-DD) or full ISO datetime from the UI.
  due_date: z
    .string()
    .min(1, "Due date is required")
    .refine((value) => !Number.isNaN(Date.parse(value)), "Valid due date is required"),
  total_marks: z.coerce.number().min(1, "Total marks must be at least 1"),
  attachment_url: z.string().optional(),
  attachment_name: z.string().optional(),
});

function normalizeDueDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  // Date-only inputs parse as UTC midnight; keep end-of-local-day for due deadlines.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    parsed.setHours(23, 59, 59, 999);
  }
  return parsed.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const access = await requireTeacherContext(request);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("class_id");
    const status = searchParams.get("status"); // active, draft, overdue
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    if (classId && !teacherHasClassAccess(assignmentScope, classId)) {
      return NextResponse.json({ error: "Forbidden - class access denied" }, { status: 403 });
    }

    if (assignmentScope.allowedClassIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Build query
    let query = supabaseAdmin
      .from("assignments")
      .select(`
        id,
        title,
        description,
        due_date,
        total_marks,
        created_at,
        class_id,
        subject_id,
        classes!inner(name),
        subjects!inner(name),
        results(id, student_id, score, grade, created_at)
      `)
      .in("teacher_id", assignmentScope.actorTeacherIds)
      .in("class_id", assignmentScope.allowedClassIds)
      .eq("school_id", schoolId);

    // Apply filters
    if (classId) {
      query = query.eq("class_id", classId);
    }

    if (status) {
      const now = new Date();
      switch (status) {
        case "active":
          query = query.gte("due_date", now.toISOString());
          break;
        case "overdue":
          query = query.lt("due_date", now.toISOString());
          break;
        // TODO: Add draft status when implemented
      }
    }

    const { data: assignments, error: assignmentsError } = await query
      .order("created_at", { ascending: false });

    if (assignmentsError) {
      console.error("Error fetching assignments:", assignmentsError);
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
    }

    const assignmentIds = uniqueValues((assignments || []).map((assignment: any) => assignment.id).filter(Boolean));
    const classIds = uniqueValues((assignments || []).map((assignment: any) => assignment.class_id).filter(Boolean));
    const [classStudentTotals, submissionCountsByAssignmentId] = await Promise.all([
      loadClassStudentTotals(schoolId, classIds),
      loadAssignmentSubmissionCounts(schoolId, assignmentIds),
    ]);

    // Aggregate real submission progress and grading workload.
    const processedAssignments = (assignments || []).map((assignment) => {
      const resultRows = assignment.results || [];
      const resultCount = resultRows.length;
      const gradedCount = resultRows.filter((row) => row.grade || row.score != null).length;
      const submittedCount = submissionCountsByAssignmentId.get(assignment.id) || 0;
      const totalStudents = classStudentTotals.get(assignment.class_id || "") || 0;

      return {
        ...assignment,
        submittedCount,
        totalStudents,
        resultCount,
        gradedCount,
        pendingGrades: Math.max(resultCount - gradedCount, 0),
      };
    });

    return NextResponse.json({ data: processedAssignments });
  } catch (error) {
    console.error("Error in teacher assignments GET:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch assignments") },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireTeacherContext(request);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validatedData = assignmentSchema.parse(body);
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    if (assignmentScope.allowedClassIds.length === 0) {
      return NextResponse.json(
        { error: "No classes are assigned to you yet" },
        { status: 403 },
      );
    }

    const assignmentTargetValidation = await validateAssignmentTarget({
      schoolId,
      allowedClassIds: assignmentScope.allowedClassIds,
      classId: validatedData.class_id,
      subjectId: validatedData.subject_id,
    });
    if (!assignmentTargetValidation.ok) {
      return NextResponse.json({ error: assignmentTargetValidation.error }, { status: assignmentTargetValidation.status });
    }

    // Prefer teachers.id (FK + school trigger); profile id is only for legacy joins.
    const teacherKey =
      resolveTeachersTableId({
        actorProfileId: access.context.profileId || userId,
        actorTeacherIds: assignmentScope.actorTeacherIds,
      }) ||
      assignmentScope.actorTeacherIds.find((id) => id !== userId) ||
      assignmentScope.actorTeacherIds[0] ||
      userId;

    // Create new assignment
    const { data: newAssignment, error: createError } = await supabaseAdmin
      .from("assignments")
      .insert({
        ...validatedData,
        due_date: normalizeDueDate(validatedData.due_date),
        teacher_id: teacherKey,
        school_id: schoolId,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating assignment:", createError);
      return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
    }

    return NextResponse.json({ data: newAssignment }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    
    console.error("Error in teacher assignments POST:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create assignment") },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await requireTeacherContext(request);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;
    
    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    // Validate update data
    const validatedData = assignmentSchema.partial().parse(updateData);
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });

    // Verify teacher owns the assignment
    const { data: assignmentCheck, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, class_id, subject_id, teacher_id")
      .eq("id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (assignmentError || !assignmentCheck) {
      return NextResponse.json({ error: "Assignment not found or access denied" }, { status: 404 });
    }

    if (
      !teacherHasClassAccess(assignmentScope, assignmentCheck.class_id) ||
      !assignmentScope.actorTeacherIds.includes(assignmentCheck.teacher_id)
    ) {
      return NextResponse.json({ error: "Assignment not found or access denied" }, { status: 404 });
    }

    if (validatedData.class_id || validatedData.subject_id) {
      const assignmentTargetValidation = await validateAssignmentTarget({
        schoolId,
        allowedClassIds: assignmentScope.allowedClassIds,
        classId: validatedData.class_id || assignmentCheck.class_id,
        subjectId: validatedData.subject_id || assignmentCheck.subject_id,
      });
      if (!assignmentTargetValidation.ok) {
        return NextResponse.json({ error: assignmentTargetValidation.error }, { status: assignmentTargetValidation.status });
      }
    }

    const updatePayload = {
      ...validatedData,
      ...(validatedData.due_date
        ? { due_date: normalizeDueDate(validatedData.due_date) }
        : {}),
    };

    // Update assignment
    const { data: updatedAssignment, error: updateError } = await supabaseAdmin
      .from("assignments")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating assignment:", updateError);
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }

    return NextResponse.json({ data: updatedAssignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    
    console.error("Error in teacher assignments PUT:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update assignment") },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await requireTeacherContext(request);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const assignmentScope = await loadTeacherAssignmentScope({
      schoolId,
      actorProfileId: userId,
    });
    
    if (!id) {
      return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 });
    }

    // Verify teacher owns the assignment
    const { data: assignmentCheck, error: assignmentError } = await supabaseAdmin
      .from("assignments")
      .select("id, class_id, teacher_id")
      .eq("id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (assignmentError || !assignmentCheck) {
      return NextResponse.json({ error: "Assignment not found or access denied" }, { status: 404 });
    }

    if (
      !teacherHasClassAccess(assignmentScope, assignmentCheck.class_id) ||
      !assignmentScope.actorTeacherIds.includes(assignmentCheck.teacher_id)
    ) {
      return NextResponse.json({ error: "Assignment not found or access denied" }, { status: 404 });
    }

    // Delete assignment
    const { error: deleteError } = await supabaseAdmin
      .from("assignments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Error deleting assignment:", deleteError);
      return NextResponse.json({ error: "Failed to delete assignment" }, { status: 500 });
    }

    return NextResponse.json({ message: "Assignment deleted successfully" });
  } catch (error) {
    console.error("Error in teacher assignments DELETE:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete assignment") },
      { status: 500 }
    );
  }
}

async function validateAssignmentTarget(input: {
  schoolId: string;
  allowedClassIds: string[];
  classId: string;
  subjectId: string;
}) {
  const [{ data: classRow, error: classError }, { data: subjectRow, error: subjectError }] =
    await Promise.all([
      supabaseAdmin
        .from("classes")
        .select("id, school_id")
        .eq("id", input.classId)
        .maybeSingle(),
      supabaseAdmin
        .from("subjects")
        .select("id, school_id")
        .eq("id", input.subjectId)
        .maybeSingle(),
    ]);

  if (classError) throw classError;
  if (subjectError) throw subjectError;

  return validateTeacherManagedAssignmentTarget({
    schoolId: input.schoolId,
    classId: input.classId,
    subjectId: input.subjectId,
    allowedClassIds: input.allowedClassIds,
    classRow,
    subjectRow,
  });
}

async function loadAssignmentSubmissionCounts(schoolId: string, assignmentIds: string[]) {
  if (assignmentIds.length === 0) {
    return new Map<string, number>();
  }

  const { data, error } = await supabaseAdmin
    .from("assignment_submissions")
    .select("assignment_id, student_profile_id")
    .eq("school_id", schoolId)
    .in("assignment_id", assignmentIds);

  if (error) throw error;

  const uniqueStudentIdsByAssignmentId = new Map<string, Set<string>>();
  for (const row of data || []) {
    const assignmentId = String(row.assignment_id || "").trim();
    const studentProfileId = String(row.student_profile_id || "").trim();
    if (!assignmentId || !studentProfileId) continue;

    const current = uniqueStudentIdsByAssignmentId.get(assignmentId) || new Set<string>();
    current.add(studentProfileId);
    uniqueStudentIdsByAssignmentId.set(assignmentId, current);
  }

  return new Map(
    Array.from(uniqueStudentIdsByAssignmentId.entries()).map(([assignmentId, studentIds]) => [
      assignmentId,
      studentIds.size,
    ])
  );
}

async function loadClassStudentTotals(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) {
    return new Map<string, number>();
  }

  const studentRows = await loadStudentClassRows(schoolId, classIds);
  const totals = new Map<string, number>();

  for (const row of studentRows) {
    const classId = String(row.class_id || "").trim();
    if (!classId) continue;

    totals.set(classId, (totals.get(classId) || 0) + 1);
  }

  return totals;
}

async function loadStudentClassRows(schoolId: string, classIds: string[]) {
  const studentTableResult = await supabaseAdmin
    .from("students")
    .select("class_id")
    .eq("school_id", schoolId)
    .in("class_id", classIds);

  if (!studentTableResult.error) {
    return studentTableResult.data || [];
  }

  const profileTableResult = await supabaseAdmin
    .from("profiles")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("role", "STUDENT")
    .in("class_id", classIds);

  if (profileTableResult.error) throw profileTableResult.error;
  return profileTableResult.data || [];
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
