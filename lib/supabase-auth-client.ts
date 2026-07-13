"use client";

import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { isSupabaseNetworkError } from "@/lib/supabase-connectivity";

let sessionLookup: Promise<{ session: Session | null; error: Error | null }> | null = null;

export async function getClientSession() {
  if (!sessionLookup) {
    sessionLookup = supabase.auth
      .getSession()
      .then((result) => ({
        session: result?.data?.session ?? null,
        error: result?.error ?? null,
      }))
      .catch((error: unknown) => {
        if (isSupabaseNetworkError(error)) {
          return { session: null, error: null };
        }
        return {
          session: null,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      })
      .finally(() => {
        sessionLookup = null;
      });
  }

  return sessionLookup;
}

export async function getClientAccessToken() {
  const { session } = await getClientSession();
  return session?.access_token || null;
}

export async function getClientUser(): Promise<User | null> {
  const { session } = await getClientSession();
  return session?.user ?? null;
}
