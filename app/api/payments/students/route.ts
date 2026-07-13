import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { applyRateLimit, getClientIp } from "@/lib/server-guards";
import { parseStudentPaymentInput } from "@/lib/payment-input";
import { requirePaymentsContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { auditDomainWrite } from "@/lib/audit-domain";
import { invalidateByTag } from "@/lib/enhanced-cache";

export async function GET(request: NextRequest) {
  try {
    const access = await requirePaymentsContext(request);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "payments", "read");
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // paid, pending, overdue
    const search = String(searchParams.get("search") || "")
      .trim()
      .toLowerCase()
      .slice(0, 80);

    // Get students with their payment summaries
    let query = supabaseAdmin
      .from("payment_summaries")
      .select(
        "school_id, student_id, first_name, last_name, email, total_payments, pending_payments, paid_payments, pending_amount, paid_amount, total_amount",
      )
      .eq("school_id", schoolId);

    // Apply status filter
    if (status) {
      switch (status) {
        case "paid":
          query = query.eq("pending_amount", 0);
          break;
        case "pending":
          query = query.gt("pending_amount", 0);
          break;
        case "overdue":
          // Overdue students are those with pending_amount > 0 AND overdue fees
          // We'll filter the list after fetching since it's a derived state
          break;
      }
    }

    const { data: students, error: studentsError } =
      await query.order("first_name");

    if (studentsError) {
      console.error("Error fetching student payments:", studentsError);
      return NextResponse.json(
        { error: "Failed to fetch student payments" },
        { status: 500 },
      );
    }

    // Get overdue student IDs
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: overdueRecords } = await supabaseAdmin
      .from("student_fees")
      .select("student_id")
      .eq("school_id", schoolId)
      .lt("due_date", todayStr)
      .in("status", ["PENDING", "PARTIAL"]);

    const overdueIds = new Set((overdueRecords || []).map((r) => r.student_id));

    // Get additional student details
    const studentIds = (students || []).map((s) => s.student_id);
    const { data: studentDetails } =
      studentIds.length > 0
        ? await supabaseAdmin
            .from("profiles")
            .select("id, phone, parent_email")
            .eq("school_id", schoolId)
            .in("id", studentIds)
        : { data: [] };

    const studentDetailsMap = Object.fromEntries(
      (studentDetails || []).map((detail) => [detail.id, detail]),
    );

    // Process students with additional info
    let processedStudents = (students || []).map((student) => {
      const isOverdue = overdueIds.has(student.student_id);
      let paymentStatus = "paid";
      if (isOverdue) paymentStatus = "overdue";
      else if (student.pending_amount > 0) paymentStatus = "pending";

      return {
        ...student,
        phone: studentDetailsMap[student.student_id]?.phone || null,
        parentEmail:
          studentDetailsMap[student.student_id]?.parent_email || null,
        paymentStatus,
        isOverdue,
      };
    });

    if (status === "overdue") {
      processedStudents = processedStudents.filter((s) => s.isOverdue);
    }

    if (search) {
      processedStudents = processedStudents.filter((student) =>
        [student.first_name, student.last_name, student.email].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(search),
        ),
      );
    }

    // Calculate summary statistics
    const totalStudents = processedStudents.length;
    const paidStudents = processedStudents.filter(
      (s) => s.pending_amount === 0,
    ).length;
    const pendingStudents = processedStudents.filter(
      (s) => s.pending_amount > 0,
    ).length;
    const totalPendingAmount = processedStudents.reduce(
      (sum, s) => sum + s.pending_amount,
      0,
    );
    const totalPaidAmount = processedStudents.reduce(
      (sum, s) => sum + s.paid_amount,
      0,
    );

    return NextResponse.json({
      data: processedStudents,
      summary: {
        totalStudents,
        paidStudents,
        pendingStudents,
        totalPendingAmount,
        totalPaidAmount,
      },
    });
  } catch (error) {
    console.error("Error in payments students GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requirePaymentsContext(request);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "payments",
      "create",
    );
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;

    const ip = getClientIp(request);
    const rate = await applyRateLimit({
      key: `payments-students:${userId}:${ip}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const { studentId, amount, paymentType, paymentMethod, referenceNumber } =
      parseStudentPaymentInput(await request.json());

    const { data: transactionResult, error: paymentError } =
      await supabaseAdmin.rpc("record_student_payment_transaction", {
        p_school_id: schoolId,
        p_student_id: studentId,
        p_amount: amount,
        p_payment_type: paymentType,
        p_payment_method: paymentMethod,
        p_reference_number: referenceNumber,
        p_created_by: userId,
      });

    if (paymentError) {
      if (paymentError.message.includes("Student not found or access denied")) {
        return NextResponse.json(
          { error: "Student not found or access denied" },
          { status: 404 },
        );
      }

      console.error("Error creating payment:", paymentError);
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 },
      );
    }

    const payload = (transactionResult || {}) as {
      payment?: { id: string };
      remaining_amount?: number | string | null;
      applied_fee_ids?: string[] | null;
    };
    const newPayment = payload.payment;

    if (!newPayment?.id) {
      return NextResponse.json(
        { error: "Failed to process payment" },
        { status: 500 },
      );
    }

    await auditDomainWrite({
      schoolId,
      userId,
      action: "payment.recorded",
      entityType: "payments",
      entityId: newPayment.id,
      newData: {
        studentId,
        amount,
        paymentType,
        paymentMethod,
        referenceNumber,
        remainingAmount: Number(payload.remaining_amount || 0),
        appliedFeeIds: payload.applied_fee_ids || [],
      },
      ipAddress: ip,
    });
    await invalidateByTag("fees");
    await invalidateByTag("dashboard");

    return NextResponse.json({ data: newPayment }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid payment submission", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Error in payments students POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
