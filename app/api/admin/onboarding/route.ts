import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

export type OnboardingStep = {
  id: "terms" | "classes" | "subjects" | "staff" | "students" | "fees";
  title: string;
  description: string;
  count: number;
  done: boolean;
  href: string;
  label: string;
  actionText: string;
};

export type OnboardingData = {
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  isComplete: boolean;
  nextStep: OnboardingStep | null;
  steps: OnboardingStep[];
};

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;

    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const [
      termsRes,
      yearsRes,
      classesRes,
      subjectsRes,
      teachersRes,
      studentsRes,
      feesRes,
    ] = await Promise.allSettled([
      supabaseAdmin
        .from("terms")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("academic_years")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("subjects")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("teachers")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
      supabaseAdmin
        .from("fees")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId),
    ]);

    const termCount = termsRes.status === "fulfilled" ? termsRes.value.count || 0 : 0;
    const yearCount = yearsRes.status === "fulfilled" ? yearsRes.value.count || 0 : 0;
    const classCount = classesRes.status === "fulfilled" ? classesRes.value.count || 0 : 0;
    const subjectCount = subjectsRes.status === "fulfilled" ? subjectsRes.value.count || 0 : 0;
    const teacherCount = teachersRes.status === "fulfilled" ? teachersRes.value.count || 0 : 0;
    const studentCount = studentsRes.status === "fulfilled" ? studentsRes.value.count || 0 : 0;
    const feeCount = feesRes.status === "fulfilled" ? feesRes.value.count || 0 : 0;

    const termsDone = termCount > 0 || yearCount > 0;
    const classesDone = classCount > 0;
    const subjectsDone = subjectCount > 0;
    const staffDone = teacherCount > 0;
    const studentsDone = studentCount > 0;
    const feesDone = feeCount > 0;

    const steps: OnboardingStep[] = [
      {
        id: "terms",
        title: "Academic Year & Terms",
        description: "Set the current academic calendar, active terms, and school calendar dates.",
        count: termCount,
        done: termsDone,
        href: "/app/admin/academic",
        label: termsDone ? `${termCount} term(s) configured` : "No terms scheduled",
        actionText: termsDone ? "Manage terms" : "Configure terms",
      },
      {
        id: "classes",
        title: "Classes & Grades",
        description: "Create class sections, streams, and grade levels (e.g. Grade 1A, Grade 8 Blue).",
        count: classCount,
        done: classesDone,
        href: "/app/admin/classes",
        label: classesDone ? `${classCount} class(es) active` : "No classes created",
        actionText: classesDone ? "Manage classes" : "Add classes",
      },
      {
        id: "subjects",
        title: "Curriculum Subjects",
        description: "Configure subjects taught at your school (Mathematics, Science, English, etc.).",
        count: subjectCount,
        done: subjectsDone,
        href: "/app/admin/subjects",
        label: subjectsDone ? `${subjectCount} subject(s) configured` : "No subjects added",
        actionText: subjectsDone ? "Manage subjects" : "Add subjects",
      },
      {
        id: "staff",
        title: "Staff & Teachers",
        description: "Invite teachers, assign classes and subjects, and configure administrative roles.",
        count: teacherCount,
        done: staffDone,
        href: "/app/principal/staff",
        label: staffDone ? `${teacherCount} teacher(s) active` : "No teachers invited",
        actionText: staffDone ? "Manage staff" : "Invite teachers",
      },
      {
        id: "students",
        title: "Student Enrollment",
        description: "Enroll learners, assign admission numbers, and link them to their classes.",
        count: studentCount,
        done: studentsDone,
        href: "/app/admin/users",
        label: studentsDone ? `${studentCount} student(s) enrolled` : "No students enrolled",
        actionText: studentsDone ? "View directory" : "Enroll students",
      },
      {
        id: "fees",
        title: "School Fees Structure",
        description: "Define tuition fees, PTA levies, exam fees, and term billing schedules.",
        count: feeCount,
        done: feesDone,
        href: "/app/payments/fees",
        label: feesDone ? `${feeCount} fee structure(s)` : "No fees defined",
        actionText: feesDone ? "Manage fees" : "Configure fees",
      },
    ];

    const completedSteps = steps.filter((s) => s.done).length;
    const totalSteps = steps.length;
    const percentComplete = Math.round((completedSteps / totalSteps) * 100);
    const isComplete = completedSteps === totalSteps;
    const nextStep = steps.find((s) => !s.done) || null;

    const payload: OnboardingData = {
      completedSteps,
      totalSteps,
      percentComplete,
      isComplete,
      nextStep,
      steps,
    };

    return applyEdgeCacheHeaders(
      NextResponse.json({ success: true, data: payload }),
      "noStore",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load onboarding status") },
      { status: 500 },
    );
  }
}
