import { NextResponse } from "next/server";

import { requireParentContext } from "@/lib/server-auth";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getParentRecord,
  getLinkedStudents,
  getClassesById,
  buildClassLabel,
  buildDisplayName,
} from "@/lib/parent-route-utils";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";

export async function GET(req: Request) {
  try {
    const access = await requireParentContext(req);
    if (!access.ok) return access.response;
    const { userId, schoolId, profileId } = access.context;
    const parentIdentityId = profileId || userId;

    const rate = await applyPlatformRateLimit({
      scope: "parent-children",
      schoolId: schoolId ?? "",
      req,
      userId,
      preset: "heavyRead",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const parentRecord =
      (await getParentRecord({ profileId: parentIdentityId, schoolId })) ||
      (parentIdentityId !== userId
        ? await getParentRecord({ profileId: userId, schoolId })
        : null);

    if (!parentRecord) {
      return jsonWithPrivateCache({ success: true, data: [] });
    }

    const linked = await getLinkedStudents({
      parentRecordId: parentRecord.id,
      parentProfileId: parentIdentityId,
      schoolId,
      fallbackRelationship: parentRecord.relation_type || null,
    });

    if (linked.profileIds.length === 0) {
      return jsonWithPrivateCache({ success: true, data: [] });
    }

    const { data: studentRows, error: studentError } = await supabaseAdmin
      .from("profiles")
      .select("id, school_id, first_name, last_name, email")
      .eq("school_id", schoolId)
      .in("id", linked.profileIds)
      .order("first_name", { ascending: true });

    if (studentError) throw studentError;

    const classIds = Array.from(
      new Set(
        linked.profileIds
          .map((profileId) => linked.classIdByProfileId.get(profileId))
          .filter(Boolean),
      ),
    ) as string[];

    const classesById = await getClassesById(schoolId, classIds);
    const data = (studentRows || []).map((row: any) => {
      const classId = linked.classIdByProfileId.get(row.id) || null;
      return {
        id: row.id,
        displayName: buildDisplayName(row),
        admissionNumber: linked.studentNumberByProfileId.get(row.id) || null,
        classId,
        className: buildClassLabel(classesById.get(classId || "")),
        relationship:
          linked.relationshipByProfileId.get(row.id) ||
          parentRecord.relation_type ||
          null,
        email: row.email || null,
      };
    });

    return jsonWithPrivateCache({ success: true, data });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load parent children") },
      { status: 500 },
    );
  }
}

function jsonWithPrivateCache(payload: unknown) {
  return applyEdgeCacheHeaders(NextResponse.json(payload), "privateRead");
}
