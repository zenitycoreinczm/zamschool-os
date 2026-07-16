import type { WorkspaceContextData } from "@/lib/workspace/context-client";
import { adminApiJson } from "@/lib/admin-browser-api";

export type ShellData = WorkspaceContextData & {
  shell: Record<string, unknown>;
};

type ShellResponse = {
  success?: boolean;
  data?: ShellData;
  error?: string;
};

const SHELL_TTL_MS = 2 * 60_000;

let cachedShell: { expiresAt: number; data: ShellData } | null = null;
let shellPromise: Promise<ShellData> | null = null;

export function readCachedShell(): ShellData | null {
  if (!cachedShell) return null;
  if (Date.now() >= cachedShell.expiresAt) {
    cachedShell = null;
    return null;
  }
  return cachedShell.data;
}

export function invalidateShell() {
  cachedShell = null;
  shellPromise = null;
}

export async function fetchShell(
  options: { force?: boolean; token?: string } = {},
): Promise<ShellData> {
  if (!options.force) {
    const cached = readCachedShell();
    if (cached) return cached;
  }

  if (!options.force && shellPromise) return shellPromise;

  shellPromise = requestShell()
    .then((data) => {
      cachedShell = { expiresAt: Date.now() + SHELL_TTL_MS, data };
      return data;
    })
    .finally(() => {
      shellPromise = null;
    });

  return shellPromise;
}

/**
 * Routes through adminApiJson which now prefers the Worker (when
 * NEXT_PUBLIC_GATEWAY_URL is set) and falls back to /api/* otherwise. The
 * legacy `token` argument is accepted for backwards compatibility but is no
 * longer required - adminApiJson uses the live Supabase session.
 */
async function requestShell(_token?: string): Promise<ShellData> {
  const payload = await adminApiJson<ShellResponse>("/api/account/shell");
  const data = payload?.data;
  if (!data) {
    throw new Error(payload?.error || "Failed to load shell");
  }
  return data;
}
