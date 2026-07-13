import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_BROWSER_CLIENT_KEY = "__zamschool_supabase_browser_client__";

export function getOrCreateBrowserClient<T>(
  storage: Record<string, unknown>,
  factory: () => T
): T {
  const existing = storage[SUPABASE_BROWSER_CLIENT_KEY] as T | undefined;
  if (existing) return existing;

  const client = factory();
  storage[SUPABASE_BROWSER_CLIENT_KEY] = client as unknown;
  return client;
}

type BrowserClientCreator<T> = (
  supabaseUrl: string,
  supabaseAnonKey: string,
  options?: Record<string, unknown>,
) => T;

export function createCookieBackedBrowserClient<T>({
  storage,
  supabaseUrl,
  supabaseAnonKey,
  createBrowserClientImpl = createBrowserClient as BrowserClientCreator<T>,
}: {
  storage: Record<string, unknown>;
  supabaseUrl: string;
  supabaseAnonKey: string;
  createBrowserClientImpl?: BrowserClientCreator<T>;
}): T {
  return getOrCreateBrowserClient(storage, () =>
    createBrowserClientImpl(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Refresh runs in the browser only; server/middleware must not call
        // /auth/v1/token on every navigation when DNS is flaky.
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );
}
