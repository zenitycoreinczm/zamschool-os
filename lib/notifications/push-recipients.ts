/** Fan-out caps for the Expo push fallback route. */
export const MAX_PUSH_USER_IDS = 200;

function normalize(raw: unknown): string {
  return String(raw ?? "").trim();
}

/** Keep only push tokens that are registered to the caller.
 *  Prevents an authenticated user of one school from sending
 *  spoofed pushes to tokens harvested elsewhere. */
export function filterOwnedTokens(
  requested: unknown[],
  owned: string[],
): string[] {
  const ownedSet = new Set(owned.map(normalize).filter(Boolean));
  const seen = new Set<string>();
  const allowed: string[] = [];

  for (const raw of requested) {
    const token = normalize(raw);
    if (!token || !ownedSet.has(token) || seen.has(token)) continue;
    seen.add(token);
    allowed.push(token);
  }

  return allowed;
}

/** Trim, dedupe, and cap the userIds fan-out list. */
export function capUserIds(userIds: unknown[]): string[] {
  const seen = new Set<string>();
  const capped: string[] = [];

  for (const raw of userIds) {
    const id = normalize(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    capped.push(id);
    if (capped.length >= MAX_PUSH_USER_IDS) break;
  }

  return capped;
}
