import { NextResponse } from "next/server";
import {
  invalidateSchoolAnnouncementsCache,
  loadSchoolAnnouncements,
} from "@/lib/announcements-server";
import { supabaseAdmin } from "@/lib/supabase";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { tenantActorRateLimitKey } from "@/lib/tenant/tenant-context";
import { requireActorContext, requireAdminContext } from "@/lib/server-auth";
import { auditDomainWrite } from "@/lib/audit-domain";
import { encodeTargetAudience } from "@/lib/target-audience";
import { refreshSchoolReadModels } from "@/lib/read-model-refresh";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  normalizeAudienceForStorage,
  normalizeTargetRoleForResponse,
  normalizeTargetRoleForStorage,
} from "@/lib/audience-targeting";

const createAnnouncementSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  targetRole: z.string().optional().nullable(),
  targetClassId: z.string().optional().nullable(),
  isPinned: z.boolean().optional().default(false),
  expiresAt: z.string().optional().nullable(),
});

type AnnouncementRow = {
  id?: string;
  school_id?: string;
  title?: string | null;
  content?: string | null;
  target_role?: string | null;
  target_audience?: string | null;
  audience?: string | null;
  target_class_id?: string | null;
  is_pinned?: boolean | null;
  expires_at?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

const updateAnnouncementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  targetRole: z.string().optional().nullable(),
  targetClassId: z.string().optional().nullable(),
  isPinned: z.boolean().optional(),
  expiresAt: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "announcements",
      "read",
    );
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const targetRole = normalizeTargetRoleForResponse(
      searchParams.get("targetRole"),
    );
    const targetClassId = searchParams.get("targetClassId");

    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 100), 1),
      100,
    );
    const rows = await loadSchoolAnnouncements(schoolId, limit);

    const normalized = normalizeAnnouncementRows(rows).filter((row) => {
      if (targetRole && row.target_role !== targetRole) return false;
      if (targetClassId && row.target_class_id !== targetClassId) return false;
      return true;
    });

    normalized.sort((left, right) => {
      if (left.is_pinned === right.is_pinned) return 0;
      return left.is_pinned ? -1 : 1;
    });

    return applyEdgeCacheHeaders(
      NextResponse.json({ success: true, data: normalized }),
      "announcements",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to fetch announcements") },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: ["PRINCIPAL"],
        requireSchool: true,
      },
      req,
    );
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "announcements",
      "create",
    );
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: tenantActorRateLimitKey({
        scope: "admin-announcements",
        schoolId,
        req,
        userId,
      }),
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, createAnnouncementSchema);
    const payload = buildAnnouncementPayload({ schoolId, userId, body });
    const data = await safeInsertWithMissingColumnRetry(
      "announcements",
      payload,
    );

    await invalidateSchoolAnnouncementsCache();
    await refreshSchoolReadModels(schoolId);
    await auditDomainWrite({
      schoolId,
      userId,
      action: "announcement.created",
      entityType: "announcement",
      entityId: data?.id,
      newData: { title: body.title, target_audience: payload.target_audience },
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      data: normalizeAnnouncementRow(data),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to create announcement") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "announcements",
      "update",
    );
    if (!perm.ok) return perm.response;
    const { schoolId, userId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: tenantActorRateLimitKey({
        scope: "admin-announcements",
        schoolId,
        req,
        userId,
      }),
      limit: 40,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateAnnouncementSchema);
    const payload = buildAnnouncementPayload({
      schoolId,
      userId: null,
      body,
      includeRequired: false,
    });
    const data = await safeUpdateWithMissingColumnRetry(
      "announcements",
      body.id,
      schoolId,
      payload,
    );

    await invalidateSchoolAnnouncementsCache();
    await auditDomainWrite({
      schoolId,
      userId,
      action: "announcement.updated",
      entityType: "announcement",
      entityId: body.id,
      newData: payload,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      data: normalizeAnnouncementRow(data),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update announcement") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;
    const perm = await requireFeatureAccess(
      access.context,
      "announcements",
      "delete",
    );
    if (!perm.ok) return perm.response;
    const { schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("school_id", schoolId);

    if (error) throw error;

    await invalidateSchoolAnnouncementsCache();
    const ip = getClientIp(req);
    await auditDomainWrite({
      schoolId,
      userId: access.context.userId,
      action: "announcement.deleted",
      entityType: "announcement",
      entityId: id,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete announcement") },
      { status: 500 },
    );
  }
}

function buildAnnouncementPayload(input: {
  schoolId: string;
  userId: string | null;
  body:
    | z.infer<typeof createAnnouncementSchema>
    | z.infer<typeof updateAnnouncementSchema>;
  includeRequired?: boolean;
}) {
  const includeRequired = input.includeRequired !== false;
  return compactRecord({
    ...(includeRequired ? { school_id: input.schoolId } : {}),
    title:
      "title" in input.body && input.body.title !== undefined
        ? input.body.title.trim()
        : undefined,
    content:
      "content" in input.body && input.body.content !== undefined
        ? input.body.content.trim()
        : undefined,
    target_role:
      "targetRole" in input.body
        ? normalizeTargetRoleForStorage(input.body.targetRole)
        : undefined,
    target_audience:
      "targetRole" in input.body || "targetClassId" in input.body
        ? encodeTargetAudience({
            targetRole:
              "targetRole" in input.body ? input.body.targetRole : null,
            targetClassId:
              "targetClassId" in input.body ? input.body.targetClassId : null,
          })
        : undefined,
    target_class_id:
      "targetClassId" in input.body
        ? input.body.targetClassId || null
        : undefined,
    created_by: includeRequired ? input.userId : undefined,
    is_pinned:
      "isPinned" in input.body ? Boolean(input.body.isPinned) : undefined,
    expires_at:
      "expiresAt" in input.body ? input.body.expiresAt || null : undefined,
    audience:
      "targetRole" in input.body
        ? normalizeAudienceForStorage(input.body.targetRole)
        : undefined,
  });
}

function normalizeAnnouncementRows(rows: AnnouncementRow[]) {
  return rows.map(normalizeAnnouncementRow);
}

function normalizeAnnouncementRow(row: AnnouncementRow): AnnouncementRow {
  return {
    ...row,
    target_audience:
      row?.target_audience ??
      encodeTargetAudience({
        targetRole: row?.target_role ?? row?.audience,
        targetClassId: row?.target_class_id,
      }),
    target_role: normalizeTargetRoleForResponse(
      row?.target_role ?? row?.target_audience ?? row?.audience,
    ),
    target_class_id: row?.target_class_id ?? null,
    is_pinned: row?.is_pinned === true,
    expires_at: row?.expires_at ?? null,
  };
}

function extractMissingColumn(message?: string) {
  if (!message) return null;
  const match = message.match(
    /column ([^.]+\.)?([a-zA-Z0-9_]+) does not exist/i,
  );
  if (match?.[2]) return match[2];
  const missing = message.match(/Could not find the '([^']+)' column/i);
  return missing?.[1] || null;
}

async function safeInsertWithMissingColumnRetry(
  table: string,
  payload: Record<string, unknown>,
) {
  let working = { ...payload };
  for (let index = 0; index < 10; index += 1) {
    const result = await supabaseAdmin
      .from(table)
      .insert(working)
      .select()
      .single();
    if (!result.error) return result.data;

    const missingColumn = extractMissingColumn(result.error.message);
    if (!missingColumn || !(missingColumn in working)) throw result.error;
    delete working[missingColumn];
  }

  throw new Error(`Failed to insert ${table}`);
}

async function safeUpdateWithMissingColumnRetry(
  table: string,
  id: string,
  schoolId: string,
  payload: Record<string, unknown>,
) {
  let working = { ...payload };
  for (let index = 0; index < 10; index += 1) {
    const result = await supabaseAdmin
      .from(table)
      .update(working)
      .eq("id", id)
      .eq("school_id", schoolId)
      .select()
      .single();

    if (!result.error) return result.data;

    const missingColumn = extractMissingColumn(result.error.message);
    if (!missingColumn || !(missingColumn in working)) throw result.error;
    delete working[missingColumn];
  }

  throw new Error(`Failed to update ${table}`);
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );
}
