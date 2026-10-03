import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import { safeErrorMessage } from "@/lib/server-guards";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { applyPlatformRateLimit, platformRateLimitResponse } from "@/lib/platform-api-guard";
import { supabaseAdmin } from "@/lib/supabase";
import { getParentRecord, getLinkedStudents, buildDisplayName } from "@/lib/parent-route-utils";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json({ error: "No school linked to this account" }, { status: 403 });
    }

    const rl = await applyPlatformRateLimit({ scope: "parent-read", schoolId, req, userId, preset: "heavyRead" });
    if (!rl.allowed) return platformRateLimitResponse(rl);

    const parentRecord = await getParentRecord({ profileId: userId, schoolId });
    if (!parentRecord) {
      return jsonResponse({ success: true, data: { fees: [], summary: emptySummary() } });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: userId,
      schoolId,
    });

    if (linked.profileIds.length === 0) {
      return jsonResponse({ success: true, data: { fees: [], summary: emptySummary() } });
    }

    const { data: feeRows, error: feeError } = await supabaseAdmin
      .from("student_fees")
      .select("id, student_id, fee_id, amount_due, amount_paid, status, due_date, billing_month, created_at")
      .eq("school_id", schoolId)
      .in("student_id", linked.profileIds)
      .order("due_date", { ascending: false });

    if (feeError) throw feeError;

    const feeIds = Array.from(new Set((feeRows || []).map((row: any) => row.fee_id).filter(Boolean)));
    const billedProfileIds = Array.from(
      new Set((feeRows || []).map((row: any) => row.student_id).filter(Boolean)),
    );

    const [feesResult, profilesResult] = await Promise.all([
      feeIds.length > 0
        ? supabaseAdmin.from("fees").select("id, name, description, amount").eq("school_id", schoolId).in("id", feeIds)
        : Promise.resolve({ data: [], error: null }),
      // Already tenant-bound: these ids are a subset of linked.profileIds, which
      // was resolved through a school-scoped students query. profiles.school_id is
      // nullable, so re-filtering here would drop pupils whose profile row has no
      // school id.
      billedProfileIds.length > 0
        ? supabaseAdmin.from("profiles").select("id, first_name, last_name, email").in("id", billedProfileIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (feesResult.error) throw feesResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const feeById = new Map((feesResult.data || []).map((row: any) => [row.id, row]));
    const profileById = new Map((profilesResult.data || []).map((row: any) => [row.id, row]));

    const fees = (feeRows || []).map((row: any) => {
      const fee = feeById.get(row.fee_id) as any;
      const profile = profileById.get(row.student_id);
      return {
        id: row.id,
        studentId: row.student_id,
        studentName: buildDisplayName(profile || {}),
        feeName: fee?.name || "Fee",
        feeDescription: fee?.description || null,
        amountDue: Number(row.amount_due) || 0,
        amountPaid: Number(row.amount_paid) || 0,
        balance: (Number(row.amount_due) || 0) - (Number(row.amount_paid) || 0),
        status: row.status || "PENDING",
        dueDate: row.due_date || null,
        billingMonth: row.billing_month || null,
        createdAt: row.created_at,
      };
    });

    const summary = {
      totalDue: fees.reduce((sum, f) => sum + f.amountDue, 0),
      totalPaid: fees.reduce((sum, f) => sum + f.amountPaid, 0),
      totalOutstanding: fees.reduce((sum, f) => sum + f.balance, 0),
      overdueCount: fees.filter((f) => f.status !== "PAID" && f.status !== "WAIVED" && f.dueDate && f.dueDate < new Date().toISOString().slice(0, 10)).length,
      paidCount: fees.filter((f) => f.status === "PAID").length,
      pendingCount: fees.filter((f) => f.status === "PENDING" || f.status === "PARTIAL").length,
    };

    return jsonResponse({ success: true, data: { fees, summary } });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent fees") },
      { status: 500 }
    );
  }
}

function jsonResponse(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "privateRead");
}

function emptySummary() {
  return { totalDue: 0, totalPaid: 0, totalOutstanding: 0, overdueCount: 0, paidCount: 0, pendingCount: 0 };
}
