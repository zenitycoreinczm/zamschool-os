import { NextResponse } from "next/server";
import { z } from "zod";

import { auditDomainWrite } from "@/lib/audit-domain";
import { applyEdgeCacheHeaders } from "@/lib/edge-cache";
import { requireFeatureAccess } from "@/lib/feature-permissions";
import {
  toSchoolDayHoursClientPayload,
} from "@/lib/school-day-hours";
import {
  loadSchoolDayHours,
  saveSchoolDayHours,
} from "@/lib/school-day-hours-server";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import { requireAdminContext } from "@/lib/server-auth";

const clock = z
  .string()
  .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Use HH:MM time format");

const updateSchema = z.object({
  timezone: z.string().min(1).max(80).optional(),
  schoolOpensAt: clock.optional(),
  classesStartAt: clock.optional(),
  classesEndAt: clock.optional(),
  schoolClosesAt: clock.optional(),
  morningReminderOffsetsMinutes: z
    .array(z.number().int().positive().max(720))
    .min(1)
    .max(8)
    .optional(),
});

/**
 * School day hours for timetable bounds + mobile morning reminders.
 * GET: leadership / academic staff
 * PUT: Head Teacher only
 */
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

    const hours = await loadSchoolDayHours(schoolId);
    return applyEdgeCacheHeaders(
      NextResponse.json({
        success: true,
        data: toSchoolDayHoursClientPayload(hours),
      }),
      "schoolSettings",
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to load school hours") },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await requireAdminContext(req);
    if (!access.ok) return access.response;

    const actorRole = String(access.context.role || "").toUpperCase();
    if (actorRole !== "PRINCIPAL" && actorRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Only the Head Teacher can set school open and class start/end times.",
        },
        { status: 403 },
      );
    }

    const perm = await requireFeatureAccess(
      access.context,
      "settings",
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

    const rate = await applyRateLimit({
      key: `admin-school-hours:${getClientIp(req)}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await parseJsonWithSchema(req, updateSchema);
    const current = await loadSchoolDayHours(schoolId);
    const merged = {
      ...current,
      ...body,
    };

    const hours = await saveSchoolDayHours(schoolId, merged);

    await auditDomainWrite({
      schoolId,
      userId,
      action: "school.hours.update",
      entityType: "school_settings",
      entityId: schoolId,
      newData: hours,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      data: toSchoolDayHoursClientPayload(hours),
    });
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error &&
      "status" in error &&
      Number((error as { status?: number }).status) === 400
        ? 400
        : 500;
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to save school hours") },
      { status },
    );
  }
}
