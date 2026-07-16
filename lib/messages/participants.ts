import { getDisplayName } from "@/lib/profile-utils";
import { fetchProfileByIdentity, profileIdentityOrFilter } from "@/lib/profile-lookup";
import { supabaseAdmin } from "@/lib/supabase";

export type MessageParticipantProfile = {
  id: string;
  auth_user_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
  school_id?: string | null;
};

export type MessageParticipantSummary = {
  id: string;
  label: string;
  role: string | null;
  email: string | null;
};

const PROFILE_COLUMNS = "id, auth_user_id, first_name, last_name, email, role, school_id";

function isMissingColumnError(error: unknown, column: string) {
  const code = (error as { code?: string | null } | null | undefined)?.code;
  const message = String(
    (error as { message?: string | null } | null | undefined)?.message || ""
  );

  return code === "42703" || message.includes(`column "${column}" does not exist`);
}

function registerProfile(
  map: Map<string, MessageParticipantProfile>,
  profile: MessageParticipantProfile
) {
  map.set(String(profile.id), profile);
  const authUserId = String(profile.auth_user_id || "").trim();
  if (authUserId) {
    map.set(authUserId, profile);
  }
}

export function summarizeParticipant(
  profile: MessageParticipantProfile | null | undefined
): MessageParticipantSummary | null {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    label: getDisplayName(profile),
    role: profile.role || null,
    email: profile.email || null,
  };
}

/** Identity stored on messages.sender_id / messages.recipient_id (auth uid when linked). */
export function resolveMessagingIdentityId(
  profile: Pick<MessageParticipantProfile, "id" | "auth_user_id">
) {
  return String(profile.auth_user_id || profile.id).trim();
}

export async function loadRecipientByIdentity(schoolId: string, recipientId: string) {
  const lookup = await fetchProfileByIdentity<MessageParticipantProfile>(
    supabaseAdmin,
    recipientId,
    PROFILE_COLUMNS
  );

  if (lookup.error) {
    throw lookup.error;
  }

  if (!lookup.data || String(lookup.data.school_id || "") !== schoolId) {
    return null;
  }

  return lookup.data;
}

export async function expandMessagingIdentityIds(
  identityIds: string[],
  schoolId: string
): Promise<string[]> {
  const profiles = await loadProfilesByIdentityIds(identityIds, schoolId);

  return Array.from(
    new Set(
      [
        ...identityIds,
        ...Array.from(profiles.keys()),
        ...Array.from(profiles.values()).flatMap((profile) => [
          profile.id,
          profile.auth_user_id,
        ]),
      ]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

export function enrichAdminMessageRows(
  rows: any[],
  profilesByIdentity: Map<string, MessageParticipantProfile>
) {
  return rows.map((row: any) => {
    const senderProfile = profilesByIdentity.get(String(row.sender_id || "")) || null;
    const recipientProfile = profilesByIdentity.get(String(row.recipient_id || "")) || null;

    return {
      ...row,
      sender: senderProfile,
      recipient: recipientProfile,
      senderLabel: summarizeParticipant(senderProfile)?.label || null,
      recipientLabel: summarizeParticipant(recipientProfile)?.label || null,
    };
  });
}

/**
 * Resolve message participant profiles by auth user id and/or profile id.
 * Results are keyed by every identity id passed in (sender_id / recipient_id values).
 */
export async function loadProfilesByIdentityIds(
  identityIds: string[],
  schoolId: string
): Promise<Map<string, MessageParticipantProfile>> {
  const ids = Array.from(
    new Set(identityIds.map((value) => String(value || "").trim()).filter(Boolean))
  );
  const result = new Map<string, MessageParticipantProfile>();

  if (ids.length === 0 || !schoolId) {
    return result;
  }

  const { data: byPrimaryId, error: primaryError } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("school_id", schoolId)
    .in("id", ids);

  if (primaryError) {
    throw primaryError;
  }

  for (const profile of (byPrimaryId || []) as MessageParticipantProfile[]) {
    registerProfile(result, profile);
  }

  const unresolved = ids.filter((id) => !result.has(id));
  if (unresolved.length > 0) {
    const { data: byAuthUserId, error: authError } = await supabaseAdmin
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("school_id", schoolId)
      .in("auth_user_id", unresolved);

    if (authError && !isMissingColumnError(authError, "auth_user_id")) {
      throw authError;
    }

    for (const profile of (byAuthUserId || []) as MessageParticipantProfile[]) {
      registerProfile(result, profile);
    }
  }

  const stillUnresolved = ids.filter((id) => !result.has(id));
  for (const identityId of stillUnresolved) {
    const lookup = await fetchProfileByIdentity<MessageParticipantProfile>(
      supabaseAdmin,
      identityId,
      PROFILE_COLUMNS
    );

    if (lookup.error) {
      throw lookup.error;
    }

    if (lookup.data && String(lookup.data.school_id || "") === schoolId) {
      registerProfile(result, lookup.data);
    }
  }

  return result;
}

export function serializeAccountMessages(
  rows: any[],
  userId: string,
  profilesByIdentity: Map<string, MessageParticipantProfile>,
  actorIdentityIds?: string[],
) {
  const actorIds = new Set(
    [userId, ...(actorIdentityIds || [])]
      .map((value) => String(value || "").trim())
      .filter(Boolean),
  );

  return rows.map((row: any) => {
    const senderId = String(row.sender_id || "").trim();
    const isFromMe = actorIds.has(senderId);
    const otherIdentityId = isFromMe ? row.recipient_id : row.sender_id;
    const otherProfile = profilesByIdentity.get(String(otherIdentityId || "")) || null;
    const senderProfile = profilesByIdentity.get(String(row.sender_id || "")) || null;
    const recipientProfile = profilesByIdentity.get(String(row.recipient_id || "")) || null;

    return {
      ...row,
      receiver_id: row.recipient_id,
      content: row.body,
      isFromMe,
      sender: summarizeParticipant(senderProfile),
      recipient: summarizeParticipant(recipientProfile),
      other: summarizeParticipant(otherProfile),
      senderName: summarizeParticipant(senderProfile)?.label || null,
      recipientName: summarizeParticipant(recipientProfile)?.label || null,
    };
  });
}

export function serializeTeacherInboxMessages(
  rows: any[],
  userId: string,
  profilesByIdentity: Map<string, MessageParticipantProfile>
) {
  return serializeAccountMessages(rows, userId, profilesByIdentity).map((row: any) => ({
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    subject: row.subject || "",
    body: row.body || "",
    isRead: Boolean(row.is_read),
    isStarred: Boolean(row.is_starred),
    createdAt: row.created_at || "",
    senderName: row.sender?.label || row.senderName || "Unknown sender",
    senderRole: row.sender?.role || null,
    recipientName: row.recipient?.label || row.recipientName || "Unknown recipient",
    other: row.other,
    isFromMe: row.isFromMe,
  }));
}

export async function loadMessageProfilesForSchool(input: {
  schoolId: string;
  identityIds: string[];
}) {
  return loadProfilesByIdentityIds(input.identityIds, input.schoolId);
}

export function profileOrFilterForIdentities(identityIds: string[]) {
  const filters = identityIds
    .map((id) => profileIdentityOrFilter(id))
    .filter(Boolean);

  if (filters.length === 0) {
    return "id.eq.00000000-0000-0000-0000-000000000000";
  }

  return filters.join(",");
}
