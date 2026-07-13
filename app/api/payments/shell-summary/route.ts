import { NextResponse } from "next/server";

import { requireFeatureAccess } from "@/lib/feature-permissions";
import { CACHE_CONFIGS, withCache } from "@/lib/enhanced-cache";
import { safeErrorMessage } from "@/lib/server-guards";
import { requirePaymentsContext } from "@/lib/server-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { READ_MOSTLY_PRIVATE_CACHE } from "@/lib/teacher-route-common";

type PaymentsShellSummary = {
  totalRevenue: number;
  pendingPayments: number;
  overduePayments: number;
  totalStudents: number;
};

export async function GET(req: Request) {
  try {
    const access = await requirePaymentsContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(access.context, "payments", "read");
    if (!perm.ok) return perm.response;

    const schoolId = access.context.schoolId;
    if (!schoolId) {
      return NextResponse.json({
        success: true,
        data: {
          totalRevenue: 0,
          pendingPayments: 0,
          overduePayments: 0,
          totalStudents: 0,
        } satisfies PaymentsShellSummary,
      });
    }

    const data = await withCache(
      `payments-shell:${schoolId}`,
      () => loadPaymentsShellSummary(schoolId),
      {
        ...CACHE_CONFIGS.admin.analytics,
        tags: ["fees", "dashboard"],
      },
    );

    const response = NextResponse.json({
      success: true,
      data,
    });

    response.headers.set("Cache-Control", READ_MOSTLY_PRIVATE_CACHE);
    return response;
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load payments summary") },
      { status: 500 },
    );
  }
}

async function loadPaymentsShellSummary(
  schoolId: string,
): Promise<PaymentsShellSummary> {
  // Fetch only amount + status (not full payment rows) and count students via head.
  const [paymentsResult, studentCountResult] = await Promise.all([
    supabaseAdmin
      .from("payments")
      .select("amount, status")
      .eq("school_id", schoolId),
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("role", ["STUDENT", "student"]),
  ]);

  if (paymentsResult.error) {
    throw paymentsResult.error;
  }

  const payments = paymentsResult.data || [];
  let totalRevenue = 0;
  let pendingPayments = 0;

  for (const payment of payments) {
    const amount = Number(payment.amount) || 0;
    const status = String(payment.status || "").toUpperCase();
    if (status === "PAID") totalRevenue += amount;
    else if (status === "PENDING") pendingPayments += amount;
  }

  return {
    totalRevenue,
    pendingPayments,
    overduePayments: 0,
    totalStudents: studentCountResult.count || 0,
  };
}
