const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const CIRCUIT_OPEN_MS = 30_000;
/** Longer pause when the host cannot be resolved at all. */
const CIRCUIT_OPEN_DNS_MS = 60_000;

let circuitOpenUntil = 0;
let lastLoggedNetworkErrorAt = 0;
let lastLoggedNetworkMessage = "";

export function resolveSupabaseHostname(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
): string | null {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).hostname;
  } catch {
    return null;
  }
}

export function isSupabaseNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const record = error as {
    code?: string;
    errno?: number;
    message?: string;
    cause?: unknown;
  };

  if (record.code && NETWORK_ERROR_CODES.has(record.code)) {
    return true;
  }

  const message = String(record.message || "");
  if (
    /ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|getaddrinfo/i.test(
      message,
    )
  ) {
    return true;
  }

  if (record.cause) {
    return isSupabaseNetworkError(record.cause);
  }

  return false;
}

export function isSupabaseCircuitOpen(now = Date.now()): boolean {
  return now < circuitOpenUntil;
}

export function openSupabaseCircuit(
  error: unknown,
  now = Date.now(),
): { opened: boolean; message: string } {
  const hostname =
    resolveSupabaseHostname() || "your Supabase project host";
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code?: string }).code === "string"
      ? (error as { code: string }).code
      : "NETWORK_ERROR";

  const dnsLike =
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    /ENOTFOUND|getaddrinfo|name not resolved/i.test(
      String(
        error && typeof error === "object" && "message" in error
          ? (error as { message?: string }).message
          : "",
      ),
    );
  const openMs = dnsLike ? CIRCUIT_OPEN_DNS_MS : CIRCUIT_OPEN_MS;
  circuitOpenUntil = Math.max(circuitOpenUntil, now + openMs);

  const message = [
    `Cannot reach Supabase at ${hostname} (${code}).`,
    "Check your internet connection, VPN/firewall, and NEXT_PUBLIC_SUPABASE_URL in .env.local.",
    `Further Supabase requests are paused for ${Math.round(openMs / 1000)}s to avoid retry storms.`,
  ].join(" ");

  // Only log once per open window for the same message.
  const shouldLog =
    now - lastLoggedNetworkErrorAt > openMs ||
    lastLoggedNetworkMessage !== message;

  if (shouldLog) {
    console.error(`[SupabaseConnectivity] ${message}`);
    lastLoggedNetworkErrorAt = now;
    lastLoggedNetworkMessage = message;
  }

  return { opened: true, message };
}

export function recordSupabaseNetworkSuccess(now = Date.now()): void {
  if (circuitOpenUntil > 0 && now >= circuitOpenUntil) {
    circuitOpenUntil = 0;
  }
}

export function resetSupabaseConnectivityState(): void {
  circuitOpenUntil = 0;
  lastLoggedNetworkErrorAt = 0;
  lastLoggedNetworkMessage = "";
}

export async function checkSupabaseConnectivity(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
): Promise<{
  ok: boolean;
  hostname: string | null;
  status: number | null;
  error: string | null;
}> {
  const hostname = resolveSupabaseHostname(url);
  if (!hostname) {
    return {
      ok: false,
      hostname: null,
      status: null,
      error: "NEXT_PUBLIC_SUPABASE_URL is missing or invalid",
    };
  }

  const healthUrl = `${String(url).replace(/\/$/, "")}/auth/v1/health`;

  try {
    const response = await fetch(healthUrl, {
      method: "GET",
      cache: "no-store",
    });
    recordSupabaseNetworkSuccess();
    return {
      ok: true,
      hostname,
      status: response.status,
      error: null,
    };
  } catch (error: unknown) {
    if (isSupabaseNetworkError(error)) {
      openSupabaseCircuit(error);
    }

    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "fetch failed";

    return {
      ok: false,
      hostname,
      status: null,
      error: message,
    };
  }
}