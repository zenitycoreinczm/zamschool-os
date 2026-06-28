import { NextResponse } from "next/server";

import { requireActorContext } from "@/lib/server-auth";
import {
  applyPlatformRateLimit,
  platformRateLimitResponse,
} from "@/lib/platform-api-guard";
import { safeErrorMessage } from "@/lib/server-guards";
import { roleDatabaseValues, type KnownRole } from "@/lib/roles";
import { resolveMessagingIdentityId } from "@/lib/messages/participants";
import { supabaseAdmin } from "@/lib/supabase";

const MESSAGING_ROLES: KnownRole[] = [
  "STUDENT",
  "PARENT",
  "TEACHER",
  "ADMIN",
  "PRINCIPAL",
  "DEPUTY_HEAD",
  "BURSAR",
  "GUIDANCE_OFFICE",
  "ACADEMIC_ADMIN",
  "HR_ADMIN",
  "ICT_ADMIN",
  "DISCIPLINE_ADMIN",
  "REGISTRAR",
];

const CONTACT_TARGETS: Record<KnownRole, KnownRole[]> = {
  STUDENT: ["TEACHER", "ADMIN", "PRINCIPAL", "DEPUTY_HEAD", "GUIDANCE_OFFICE"],
  PARENT: [
    "TEACHER",
    "ADMIN",
    "PRINCIPAL",
    "DEPUTY_HEAD",
    "GUIDANCE_OFFICE",
    "BURSAR",
  ],
  TEACHER: ["STUDENT", "PARENT", "ADMIN", "PRINCIPAL", "DEPUTY_HEAD"],
  ADMIN: ["TEACHER", "PARENT", "STUDENT", "PRINCIPAL", "DEPUTY_HEAD"],
  PRINCIPAL: ["TEACHER", "PARENT", "STUDENT", "DEPUTY_HEAD", "BURSAR"],
  DEPUTY_HEAD: ["TEACHER", "PARENT", "STUDENT", "PRINCIPAL"],
  BURSAR: ["PARENT", "ADMIN", "PRINCIPAL"],
  PAYMENTS: ["PARENT", "ADMIN", "PRINCIPAL"],
  GUIDANCE_OFFICE: ["STUDENT", "PARENT", "TEACHER", "PRINCIPAL"],
  ACADEMIC_ADMIN: ["TEACHER", "PRINCIPAL", "DEPUTY_HEAD"],
  HR_ADMIN: ["TEACHER", "ADMIN", "PRINCIPAL"],
  ICT_ADMIN: ["ADMIN", "PRINCIPAL", "TEACHER"],
  DISCIPLINE_ADMIN: ["STUDENT", "PARENT", "TEACHER", "PRINCIPAL"],
  REGISTRAR: ["TEACHER", "PRINCIPAL", "DEPUTY_HEAD", "ADMIN"],
  SUPER_ADMIN: ["ADMIN", "PRINCIPAL"],
};

export async function GET(req: Request) {
  try {
    const access = await requireActorContext(
      {
        allowedRoles: MESSAGING_ROLES,
        requireSchool: true,
      },
      req,
    );

    if (!access.ok) return access.response;

    const { schoolId, userId, role } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const rate = await applyPlatformRateLimit({
      scope: "account-contacts",
      schoolId,
      req,
      userId: access.context.userId,
      preset: "accountContacts",
    });
    if (!rate.allowed) return platformRateLimitResponse(rate);

    const targetRoles = CONTACT_TARGETS[role] || [
      "TEACHER",
      "ADMIN",
      "PRINCIPAL",
    ];
    const roleValues = Array.from(
      new Set(targetRoles.flatMap((target) => roleDatabaseValues(target))),
    );

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || 200), 1),
      500,
    );

    let rows: Array<{
      id: string;
      auth_user_id?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      role?: string | null;
    }> = [];

    const withAuthLink = await supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, first_name, last_name, email, role")
      .eq("school_id", schoolId)
      .in("role", roleValues)
      .order("first_name", { ascending: true })
      .limit(limit);

    if (withAuthLink.error) {
      const code = (withAuthLink.error as { code?: string }).code;
      const message = String(
        (withAuthLink.error as { message?: string }).message || "",
      );
      if (
        code !== "42703" &&
        !message.includes('column "auth_user_id" does not exist')
      ) {
        throw withAuthLink.error;
      }

      const fallback = await supabaseAdmin
        .from("profiles")
        .select("id, first_name, last_name, email, role")
        .eq("school_id", schoolId)
        .in("role", roleValues)
        .order("first_name", { ascending: true })
        .limit(limit);

      if (fallback.error) throw fallback.error;
      rows = (fallback.data || []) as typeof rows;
    } else {
      rows = (withAuthLink.data || []) as typeof rows;
    }

    return NextResponse.json({
      data: rows
        .map((row) => ({
          row,
          identityId: resolveMessagingIdentityId(row),
        }))
        .filter((entry) => entry.identityId !== userId)
        .map(({ row, identityId }) => ({
          id: identityId,
          profileId: row.id,
          label: buildDisplayName(row),
          email: row.email || null,
          role: String(row.role || "").toLowerCase(),
        })),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load contacts") },
      { status: 500 },
    );
  }
}

function buildDisplayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return (
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.email ||
    "Contact"
  );
}
