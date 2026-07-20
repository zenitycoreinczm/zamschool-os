import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";

const pushSchema = z.object({
  userIds: z.array(z.string()).optional(),
  tokens: z.array(z.string()).optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.string().optional(),
  tab: z.string().optional(),
  referenceId: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  schoolId: z.string().optional().nullable(),
});

/**
 * Fan-out Expo push to user devices. Used by mobile pushDispatchService fallback
 * when the Supabase edge function is unavailable or has no tokens.
 */
export async function POST(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;
    if (!actor.schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const body = await parseJsonWithSchema(req, pushSchema);
    const title = body.title.trim();
    const messageBody = body.body.trim();
    const userIds = Array.from(
      new Set((body.userIds || []).map((id) => String(id || "").trim()).filter(Boolean)),
    );
    let tokens = Array.from(
      new Set((body.tokens || []).map((t) => String(t || "").trim()).filter(Boolean)),
    );

    if (userIds.length === 0 && tokens.length === 0) {
      return NextResponse.json(
        { error: "userIds or tokens required", sent: 0 },
        { status: 400 },
      );
    }

    if (userIds.length > 0) {
      // Expand profile ids → auth ids for user_devices lookups
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, auth_user_id")
        .eq("school_id", actor.schoolId)
        .in("id", userIds);

      const lookupIds = new Set(userIds);
      for (const row of profiles || []) {
        if (row.auth_user_id) lookupIds.add(String(row.auth_user_id));
        if (row.id) lookupIds.add(String(row.id));
      }

      // Also reverse: if given auth ids, include profile ids
      const { data: byAuth } = await supabaseAdmin
        .from("profiles")
        .select("id, auth_user_id")
        .eq("school_id", actor.schoolId)
        .in("auth_user_id", userIds);
      for (const row of byAuth || []) {
        if (row.id) lookupIds.add(String(row.id));
        if (row.auth_user_id) lookupIds.add(String(row.auth_user_id));
      }

      const ids = Array.from(lookupIds);
      let devices: Array<{ push_token?: string | null; expo_push_token?: string | null }> =
        [];

      const primary = await supabaseAdmin
        .from("user_devices")
        .select("push_token, expo_push_token")
        .eq("school_id", actor.schoolId)
        .in("user_id", ids);
      if (!primary.error) {
        devices = primary.data || [];
      } else {
        const alt = await supabaseAdmin
          .from("user_devices")
          .select("push_token")
          .eq("school_id", actor.schoolId)
          .in("user_id", ids);
        if (!alt.error) devices = alt.data || [];
        else {
          const legacy = await supabaseAdmin
            .from("user_devices")
            .select("expo_push_token")
            .eq("school_id", actor.schoolId)
            .in("user_id", ids);
          devices = legacy.data || [];
        }
      }

      for (const device of devices) {
        const token = String(device.push_token || device.expo_push_token || "").trim();
        if (token) tokens.push(token);
      }
      tokens = Array.from(new Set(tokens));
    }

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        error:
          "No device tokens in user_devices for these users. Recipients must open the app once with notifications enabled.",
      });
    }

    const messages = tokens.map((to) => ({
      to,
      title,
      body: messageBody,
      sound: "default",
      priority: "high",
      channelId: "default",
      data: {
        type: body.type || "GENERAL",
        tab: body.tab || "notifications",
        referenceId: body.referenceId || null,
        ...(body.data || {}),
      },
    }));

    let sent = 0;
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          data?: Array<{ status?: string }> | { status?: string };
        };
        const tickets = Array.isArray(json?.data)
          ? json.data
          : json?.data
            ? [json.data]
            : [];
        sent += tickets.filter((t) => t?.status === "ok").length || chunk.length;
      }
    }

    return NextResponse.json({ success: true, sent, tokenCount: tokens.length });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to send push notifications") },
      { status: 500 },
    );
  }
}
