import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { z } from "zod";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { tenantActorRateLimitKey } from "@/lib/tenant/tenant-context";
import { requireActorContext } from "@/lib/server-auth";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import { nanoid } from "nanoid";
import {
  buildCreatedAuthUserMetadata,
  buildCreatedProfilePayload,
  generateTemporaryPassword,
  hashTemporaryPassword,
} from "@/lib/account-state";
import { roleToStoredValue } from "@/lib/roles";
import { createAuditLog } from "@/lib/audit-log";
import { canActorCreateSchoolRole } from "@/lib/account-create-policy";
import { sendAccountCredentialsEmail } from "@/lib/send-account-credentials";
import { invalidateActorCaches } from "@/lib/invalidate-actor-caches";
import { createOrUpdateAuthUserWithTemporaryPassword } from "@/lib/auth-admin-users";
const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "teacher",
    "payments",
    "bursar",
    "deputy_head",
    "guidance_office",
    "academic_admin",
    "hr_admin",
    "ict_admin",
    "discipline_admin",
    "registrar",
  ]),
  department: z.string().max(120).optional(),
  position: z.string().max(120).optional(),
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  phone: z.string().max(40).optional(),
  send_email: z.boolean().optional().default(false),
});
const INVITATION_PUBLIC_COLUMNS =
  "id,school_id,invited_by,email,role,department,position,first_name,last_name,phone,token,expires_at,accepted_at,accepted_by,revoked_at,auth_user_id,created_at";
function generateToken(): string {
  return `${nanoid(32)}${Date.now().toString(36)}`;
}
function stripSensitiveFields(record: Record<string, unknown>) {
  const { temporary_password, ...safe } = record;
  void temporary_password;
  return safe;
}

function stripUnknownColumn(
  payload: Record<string, unknown>,
  message: string,
): Record<string, unknown> | null {
  // PostgREST emits either a Postgres 42703 error ("column X does not
  // exist") or a PGRST204 error ("Could not find the 'X' column of 'table'
  // in the schema cache").  Both need to trigger the strip-and-retry path.
  const pgMatch = message.match(
    /column\s+(?:[a-z_]+\.)?([a-zA-Z0-9_]+)\s+does not exist/i,
  );
  const pgrstMatch = message.match(
    /Could not find the '([a-zA-Z0-9_]+)' column/i,
  );
  const columnName = pgMatch?.[1] || pgrstMatch?.[1];
  if (columnName && columnName in payload) {
    const { [columnName]: _removed, ...rest } = payload;
    void _removed;
    return rest;
  }
  return null;
}
// Staff invitations are restricted to the Head Teacher (PRINCIPAL) and
// platform super admin.  Other admin roles (HR_ADMIN, ICT_ADMIN, etc.)
// manage staff records through the Users page, not the invitation flow.
const STAFF_INVITATION_ROLES = ["PRINCIPAL", "SUPER_ADMIN"] as const;

export async function GET(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: [...STAFF_INVITATION_ROLES],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  const perm = await requireFeatureAccess(access.context, "users", "read");
  if (!perm.ok) return perm.response;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let query = supabaseAdmin
      .from("staff_invitations")
      .select(
        `${INVITATION_PUBLIC_COLUMNS}, invited_by_profile:invited_by(first_name, last_name, email)`,
      )
      .eq("school_id", access.context.schoolId)
      .order("created_at", { ascending: false });
    if (status === "pending" || status === "active")
      query = query.is("revoked_at", null);
    if (status === "accepted") query = query.is("revoked_at", null);
    if (status === "revoked") query = query.not("revoked_at", "is", null);
    const { data, error } = await query.limit(100);
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to fetch invitations") },
      { status: 500 },
    );
  }
}
export async function POST(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: [...STAFF_INVITATION_ROLES],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  if (!access.context.schoolId) {
    return NextResponse.json(
      { error: "No school linked to this account" },
      { status: 403 },
    );
  }
  const schoolId = access.context.schoolId;
  const perm = await requireFeatureAccess(access.context, "users", "create");
  if (!perm.ok) {
    console.error("Permission denied for staff invitation:", perm.response);
    return perm.response;
  }
  const ip = getClientIp(req);
  const rate = await applyRateLimit({
    key: tenantActorRateLimitKey({
      scope: "invitations",
      schoolId: access.context.schoolId,
      req,
      userId: access.context.userId,
    }),
    limit: 30,
    windowMs: 60_000,
    failOpen: true,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }
  let step = "parsing";
  try {
    const body = await parseJsonWithSchema(req, createInvitationSchema);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const role = body.role;
    const department = body.department;
    const position = body.position;
    const first_name = String(body.first_name || "").trim();
    const last_name = String(body.last_name || "").trim();
    const phone = body.phone ? String(body.phone).trim() : undefined;
    const sendEmail = body.send_email === true;
    if (!email || !role || !first_name || !last_name) {
      return NextResponse.json(
        {
          error: "Missing required fields: email, role, first_name, last_name",
        },
        { status: 400 },
      );
    }
    const normalizedRole = roleToStoredValue(role);
    if (!normalizedRole) {
      return NextResponse.json(
        { error: "Invalid role specified" },
        { status: 400 },
      );
    }
    if (!canActorCreateSchoolRole(access.context.role, normalizedRole)) {
      return NextResponse.json(
        { error: "You don't have permission to invite staff" },
        { status: 403 },
      );
    }
    step = "duplicate_check";
    const { data: existing } = await supabaseAdmin
      .from("staff_invitations")
      .select("id, email")
      .eq("school_id", access.context.schoolId)
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "An active invitation already exists for this email address" },
        { status: 409 },
      );
    }
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("school_id", access.context.schoolId)
      .eq("email", email)
      .maybeSingle();
    if (existingProfile) {
      return NextResponse.json(
        { error: "A user with this email already exists at this school" },
        { status: 409 },
      );
    }
    // Delete stale invitation rows, but keep any matching auth user and reset
    // its password below so the displayed temporary password always works.
    await supabaseAdmin
      .from("staff_invitations")
      .delete()
      .eq("school_id", access.context.schoolId)
      .eq("email", email)
      .or("accepted_at.not.is.null,revoked_at.not.is.null");
    const temporaryPassword = generateTemporaryPassword();
    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    step = "auth_user_creation";
    // Prove sign-in with this password before we return it to the inviter.
    const authResult = await createOrUpdateAuthUserWithTemporaryPassword({
      email,
      temporaryPassword,
      userMetadata: buildCreatedAuthUserMetadata({
        firstName: first_name,
        lastName: last_name,
        role: normalizedRole,
      }),
    });
    const authUserId = authResult.user.id;

    step = "profile_creation";
    const profilePayload = buildCreatedProfilePayload({
      authUserId,
      schoolId,
      role: normalizedRole,
      firstName: first_name,
      lastName: last_name,
      email,
      phone: phone || null,
      profileExtras: {
        department: department || null,
        ...(position ? { position } : {}),
      },
    });

    try {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert(profilePayload);
      if (profileError) {
        const message = String(profileError.message || "");
        const code = String(profileError.code || "");
        const isMissingColumn =
          message.includes("does not exist") ||
          code === "42703" ||
          code === "PGRST204" ||
          /Could not find the '\w+' column/i.test(message);
        if (isMissingColumn) {
          const stripped = stripUnknownColumn(profilePayload, message);
          if (stripped) {
            const { error: retryError } = await supabaseAdmin
              .from("profiles")
              .insert(stripped);
            if (retryError) throw retryError;
          } else {
            throw profileError;
          }
        } else {
          throw profileError;
        }
      }
      await invalidateActorCaches(authUserId);
    } catch (profileErr) {
      if (authResult.created) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw profileErr;
    }

    step = "invitation_insert";
    const { data, error } = await supabaseAdmin
      .from("staff_invitations")
      .insert({
        school_id: access.context.schoolId,
        created_by: access.context.userId,
        invited_by: access.context.userId,
        email,
        role: normalizedRole,
        department: department || null,
        position: position || null,
        first_name,
        last_name,
        phone: phone || null,
        token,
        temporary_password: null,
        temp_password_hash: hashTemporaryPassword(temporaryPassword),
        auth_user_id: authUserId,
        expires_at: expiresAt,
        status: "accepted",
      })
      .select(INVITATION_PUBLIC_COLUMNS)
      .single();
    if (error) {
      console.error("Failed to insert staff invitation:", error);
      if (authResult.created) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      throw error;
    }
    const acceptUrl = `${process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000"}/accept-invitation?token=${token}`;
    await createAuditLog({
      schoolId: access.context.schoolId,
      userId: access.context.userId,
      action: "staff.invited",
      entityType: "staff_invitation",
      entityId: data.id,
      newData: {
        email,
        role: normalizedRole,
        department: department || null,
        position: position || null,
        directCreate: true,
      },
      ipAddress: ip,
    });

    let credentialsEmailSent = false;
    if (sendEmail) {
      const emailPromise = sendAccountCredentialsEmail({
        to: email,
        firstName: first_name,
        role: normalizedRole,
        temporaryPassword,
        acceptUrl,
      });
      emailPromise
        .then((result) => {
          console.log(
            `[invite] Credentials email sent to ${email} — messageId=${result.messageId || "N/A"}`,
          );
        })
        .catch((err) => {
          console.error("[invite] Background email failed:", err);
        });
      credentialsEmailSent = true;
    }

    const safeData = stripSensitiveFields(
      data as unknown as Record<string, unknown>,
    );
    return NextResponse.json({
      success: true,
      data: {
        ...safeData,
        accept_url: acceptUrl,
        temporary_password: temporaryPassword,
        credentials_email_sent: credentialsEmailSent,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Staff invitation failed at step '${step}':`, err);
    if (
      message.toLowerCase().includes("duplicate key") ||
      message.toLowerCase().includes("already been registered") ||
      message.toLowerCase().includes("already registered")
    ) {
      return NextResponse.json(
        {
          error:
            "An active invitation or account already exists for this email address",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: safeErrorMessage(
          err,
          "Failed to save invitation. Please try again.",
        ),
      },
      { status: 500 },
    );
  }
}
export async function DELETE(req: Request) {
  const access = await requireActorContext(
    {
      allowedRoles: [...STAFF_INVITATION_ROLES],
      requireSchool: true,
    },
    req,
  );
  if (!access.ok) return access.response;
  const perm = await requireFeatureAccess(access.context, "users", "delete");
  if (!perm.ok) return perm.response;
  try {
    const { searchParams } = new URL(req.url);
    const invitationId = searchParams.get("id");
    if (!invitationId) {
      return NextResponse.json(
        { error: "Invitation ID is required" },
        { status: 400 },
      );
    }
    // Fetch the invitation to get the auth_user_id before revoking
    const { data: invite } = await supabaseAdmin
      .from("staff_invitations")
      .select("id, auth_user_id, email, revoked_at")
      .eq("id", invitationId)
      .eq("school_id", access.context.schoolId)
      .is("revoked_at", null)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json(
        { error: "Invitation not found or already revoked" },
        { status: 404 },
      );
    }

    // status CHECK allows only: pending | accepted | expired | cancelled
    const { error } = await supabaseAdmin
      .from("staff_invitations")
      .update({
        revoked_at: new Date().toISOString(),
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId)
      .eq("school_id", access.context.schoolId)
      .is("revoked_at", null);
    if (error) throw error;

    // Clean up the orphaned auth user created during the invitation
    if (invite.auth_user_id) {
      const { error: deleteAuthError } =
        await supabaseAdmin.auth.admin.deleteUser(invite.auth_user_id);
      if (deleteAuthError) {
        console.error(
          `[invite] Failed to delete auth user ${invite.auth_user_id} during revoke:`,
          deleteAuthError,
        );
      }
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Failed to revoke invitation") },
      { status: 500 },
    );
  }
}
