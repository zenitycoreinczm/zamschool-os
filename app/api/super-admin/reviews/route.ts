import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireActorContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { createAuditLog } from "@/lib/audit-log";

/**
 * Super-admin moderation surface for public site reviews.
 * GET    - latest ratings (all states)
 * PATCH  - approve / unapprove / hide / unhide by id
 * DELETE - remove a rating entirely (audit-logged)
 */

const listRateLimit = {
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: "super-admin-reviews",
};

const mutationSchema = z.object({
  id: z.string().uuid(),
  approved: z.boolean().optional(),
  hidden: z.boolean().optional(),
});

async function requireSuperAdmin(req: NextRequest) {
  return requireActorContext(
    { allowedRoles: ["SUPER_ADMIN"], requireSchool: false },
    req,
  );
}

export async function GET(req: NextRequest) {
  const access = await requireSuperAdmin(req);
  if (!access.ok) return access.response;

  const limited = await applyRateLimit({
    key: `${listRateLimit.keyPrefix}:${access.context.userId}:${getClientIp(req)}`,
    limit: listRateLimit.maxRequests,
    windowMs: listRateLimit.windowMs,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 },
    );
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("site_ratings")
      .select(
        "id, rating, comment, name, school, page, approved, hidden, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load reviews") },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const access = await requireSuperAdmin(req);
  if (!access.ok) return access.response;

  try {
    const body = await parseJsonWithSchema(req, mutationSchema);

    const updates: { approved?: boolean; hidden?: boolean } = {};
    if (typeof body.approved === "boolean") updates.approved = body.approved;
    if (typeof body.hidden === "boolean") updates.hidden = body.hidden;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 },
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("site_ratings")
      .update(updates)
      .eq("id", body.id)
      .select("id, approved, hidden")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Review not found" },
        { status: 404 },
      );
    }

    await createAuditLog({
      schoolId: null,
      userId: access.context.userId,
      action: "site_review.updated",
      entityType: "site_review",
      entityId: body.id,
      newData: updates,
      ipAddress: getClientIp(req),
    }).catch(() => {});

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to update review") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const access = await requireSuperAdmin(req);
  if (!access.ok) return access.response;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id") || "";

    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from("site_ratings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    await createAuditLog({
      schoolId: null,
      userId: access.context.userId,
      action: "site_review.deleted",
      entityType: "site_review",
      entityId: id,
      ipAddress: getClientIp(req),
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to delete review") },
      { status: 500 },
    );
  }
}
