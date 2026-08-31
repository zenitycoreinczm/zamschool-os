const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

export function parseMessageListLimit(raw: string | null): number {
  if (raw === null || raw === "") return DEFAULT_LIST_LIMIT;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.max(Math.floor(parsed), 1), MAX_LIST_LIMIT);
}

export function parseMessageListOffset(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(Math.floor(parsed), 0);
}
