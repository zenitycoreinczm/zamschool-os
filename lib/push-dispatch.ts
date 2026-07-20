import { supabaseAdmin } from "@/lib/supabase";

export type PushMessageInput = {
  userId: string;
  title: string;
  body: string;
  type?: string;
  tab?: string;
  data?: Record<string, unknown>;
};

/**
 * Send Expo push notifications to devices for the given profile/auth user ids.
 * Looks up user_devices by profile id and auth_user_id.
 * Soft-fails: returns 0 sent on missing table / no tokens.
 */
export async function dispatchExpoPushToUsers(
  schoolId: string,
  messages: PushMessageInput[],
): Promise<{ sent: number; tokenCount: number }> {
  if (!schoolId || !messages.length) return { sent: 0, tokenCount: 0 };

  const byUser = new Map<string, PushMessageInput>();
  for (const msg of messages) {
    const id = String(msg.userId || "").trim();
    if (!id || !msg.title || !msg.body) continue;
    if (!byUser.has(id)) byUser.set(id, msg);
  }
  if (byUser.size === 0) return { sent: 0, tokenCount: 0 };

  const userIds = Array.from(byUser.keys());

  const [{ data: profilesById }, { data: profilesByAuth }] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("school_id", schoolId)
      .in("id", userIds),
    supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id")
      .eq("school_id", schoolId)
      .in("auth_user_id", userIds),
  ]);

  const lookupIds = new Set(userIds);
  const authByProfile = new Map<string, string>();
  const profileByAuth = new Map<string, string>();

  for (const row of [...(profilesById || []), ...(profilesByAuth || [])]) {
    if (row?.id) lookupIds.add(String(row.id));
    if (row?.auth_user_id) {
      lookupIds.add(String(row.auth_user_id));
      authByProfile.set(String(row.id), String(row.auth_user_id));
      profileByAuth.set(String(row.auth_user_id), String(row.id));
    }
  }

  const ids = Array.from(lookupIds);
  let devices: Array<{
    user_id?: string | null;
    push_token?: string | null;
    expo_push_token?: string | null;
  }> = [];

  const primary = await supabaseAdmin
    .from("user_devices")
    .select("user_id, push_token, expo_push_token")
    .eq("school_id", schoolId)
    .in("user_id", ids);
  if (!primary.error) {
    devices = primary.data || [];
  } else {
    const alt = await supabaseAdmin
      .from("user_devices")
      .select("user_id, push_token")
      .eq("school_id", schoolId)
      .in("user_id", ids);
    if (!alt.error) {
      devices = alt.data || [];
    } else {
      const legacy = await supabaseAdmin
        .from("user_devices")
        .select("user_id, expo_push_token")
        .eq("school_id", schoolId)
        .in("user_id", ids);
      if (legacy.error) {
        console.warn("[push] user_devices unavailable:", legacy.error.message);
        return { sent: 0, tokenCount: 0 };
      }
      devices = legacy.data || [];
    }
  }

  const tokensByUser = new Map<string, Set<string>>();
  for (const device of devices) {
    const uid = String(device.user_id || "").trim();
    const token = String(
      device.push_token || device.expo_push_token || "",
    ).trim();
    if (!uid || !token) continue;
    const set = tokensByUser.get(uid) || new Set<string>();
    set.add(token);
    tokensByUser.set(uid, set);
  }

  const expoMessages: Array<Record<string, unknown>> = [];
  for (const [userId, content] of byUser.entries()) {
    const tokens = new Set<string>();
    for (const t of tokensByUser.get(userId) || []) tokens.add(t);
    const authId = authByProfile.get(userId);
    if (authId) {
      for (const t of tokensByUser.get(authId) || []) tokens.add(t);
    }
    const profileId = profileByAuth.get(userId);
    if (profileId) {
      for (const t of tokensByUser.get(profileId) || []) tokens.add(t);
    }

    for (const token of tokens) {
      expoMessages.push({
        to: token,
        title: content.title,
        body: content.body,
        sound: "default",
        priority: "high",
        channelId: "default",
        data: {
          type: content.type || "general",
          tab: content.tab || "notifications",
          schoolId,
          ...(content.data || {}),
        },
      });
    }
  }

  if (expoMessages.length === 0) {
    return { sent: 0, tokenCount: 0 };
  }

  let sent = 0;
  const chunkSize = 100;
  for (let i = 0; i < expoMessages.length; i += chunkSize) {
    const chunk = expoMessages.slice(i, i + chunkSize);
    try {
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
        sent +=
          tickets.filter((t) => t?.status === "ok").length || chunk.length;
      } else {
        const text = await res.text().catch(() => "");
        console.error("[push] Expo send failed:", res.status, text);
      }
    } catch (err) {
      console.error("[push] Expo send threw:", err);
    }
  }

  return { sent, tokenCount: expoMessages.length };
}
