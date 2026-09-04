import { supabaseAdmin } from "@/lib/supabase";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { requireActorContext } from "@/lib/server-auth";
import { createAuditLog } from "@/lib/audit-log";

const createAccessCodeSchema = z.object({
  expiresInHours: z.number().int().min(1).max(24 * 30).optional().default(3),
  maxUses: z.number().int().min(1).max(100).optional().default(1),
  province: z.string().max(120).optional().nullable(),
  district: z.string().max(120).optional().nullable(),
  schoolType: z.string().max(120).optional().nullable(),
  ownershipType: z.string().max(120).optional().nullable(),
  approvalStatus: z.enum(["pending", "approved"]).optional().default("approved"),
  notes: z.string().max(500).optional().nullable(),
});

function generateSixDigitCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 1_000_000).toString().padStart(6, "0");
}

export async function GET(req: Request) {
  const access = await requireActorContext(
    { allowedRoles: ["SUPER_ADMIN"], requireSchool: false },
    req
  );
  if (!access.ok) return access.response;

  const ip = getClientIp(req);
  const rate = await applyRateLimit({
    key: `list-access-codes:${access.context.userId}:${ip}`,
    limit: 30,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("access_codes")
      .select(
        "code, created_at, expires_at, used_at, used_by_email, max_uses, use_count, province, district, school_type, ownership_type, approval_status, notes"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to fetch codes") },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const access = await requireActorContext(
    { allowedRoles: ["SUPER_ADMIN"], requireSchool: false },
    req
  );
  if (!access.ok) return access.response;

  const ip = getClientIp(req);
  const rate = await applyRateLimit({
    key: `create-access-code:${access.context.userId}:${ip}`,
    limit: 20,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const body = await parseJsonWithSchema(req, createAccessCodeSchema);
    let code = "";

    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = generateSixDigitCode();
      const { data: existing } = await supabaseAdmin
        .from("access_codes")
        .select("code")
        .eq("code", candidate)
        .maybeSingle();

      if (!existing) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      return NextResponse.json(
        { error: "Failed to generate a unique access code. Please try again." },
        { status: 500 }
      );
    }

    const expiresAt = new Date(
      Date.now() + body.expiresInHours * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await supabaseAdmin
      .from("access_codes")
      .insert({
        code,
        expires_at: expiresAt,
        created_by: access.context.userId,
        max_uses: body.maxUses,
        use_count: 0,
        province: body.province || null,
        district: body.district || null,
        school_type: body.schoolType || null,
        ownership_type: body.ownershipType || null,
        approval_status: body.approvalStatus,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    await createAuditLog({
      schoolId: null,
      userId: access.context.userId,
      action: "access_code.created",
      entityType: "access_code",
      entityId: code,
      newData: {
        expires_at: expiresAt,
        max_uses: body.maxUses,
        province: body.province || null,
        district: body.district || null,
        school_type: body.schoolType || null,
        ownership_type: body.ownershipType || null,
        approval_status: body.approvalStatus,
      },
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to create access code") },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const access = await requireActorContext(
    { allowedRoles: ["SUPER_ADMIN"], requireSchool: false },
    req
  );
  if (!access.ok) return access.response;

  const ip = getClientIp(req);
  const rate = await applyRateLimit({
    key: `delete-access-code:${access.context.userId}:${ip}`,
    limit: 20,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code parameter." }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("access_codes")
      .delete()
      .eq("code", code)
      .is("used_at", null);

    if (error) throw error;

    await createAuditLog({
      schoolId: null,
      userId: access.context.userId,
      action: "access_code.deleted",
      entityType: "access_code",
      entityId: code,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to delete code") },
      { status: 500 }
    );
  }
}
