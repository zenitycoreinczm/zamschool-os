import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateAccountPortalRequest } from "@/lib/account-portal-auth";
import { parseJsonWithSchema, safeErrorMessage } from "@/lib/server-guards";
import { supabaseAdmin } from "@/lib/supabase";

const upsertSchema = z.object({
  token: z.string().min(8).max(512),
  platform: z.enum(["ios", "android", "web", "unknown"]).optional(),
  provider: z.string().optional(),
});

const deleteSchema = z.object({
  token: z.string().min(8).max(512),
});

/**
 * Register / refresh an Expo (or FCM) device token for the signed-in user.
 * Mobile primary path writes to Supabase user_devices; this is the webapp mirror.
 */
export async function POST(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const body = await parseJsonWithSchema(req, upsertSchema);
    const token = body.token.trim();
    const platform = body.platform || "unknown";
    const provider = body.provider || "expo";

    // Store under auth uid (user_devices.user_id → auth.users).
    // Also store under profile id when different so lookups by either work.
    const userIds = Array.from(
      new Set(
        [actor.userId, actor.profileId].map((id) => String(id || "").trim()).filter(Boolean),
      ),
    );

    for (const userId of userIds) {
      const row = {
        user_id: userId,
        push_token: token,
        platform,
        provider,
        last_seen_at: new Date().toISOString(),
      };

      const upsert = await supabaseAdmin.from("user_devices").upsert(row, {
        onConflict: "push_token",
      });

      if (upsert.error) {
        // Schema variants: expo_push_token column instead of push_token
        const legacy = await supabaseAdmin.from("user_devices").upsert(
          {
            user_id: userId,
            expo_push_token: token,
            platform,
            provider,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "expo_push_token" },
        );
        if (legacy.error) {
          // Unique on user_id+token only — try plain insert
          await supabaseAdmin.from("user_devices").insert({
            user_id: userId,
            push_token: token,
            platform,
            provider,
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to save push token") },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const actor = await authenticateAccountPortalRequest(req);
    if ("response" in actor) return actor.response;

    const body = await parseJsonWithSchema(req, deleteSchema);
    const token = body.token.trim();

    await Promise.all([
      supabaseAdmin.from("user_devices").delete().eq("push_token", token),
      supabaseAdmin.from("user_devices").delete().eq("expo_push_token", token),
    ]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to remove push token") },
      { status: 500 },
    );
  }
}
