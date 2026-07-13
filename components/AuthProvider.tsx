"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getClientSession } from "@/lib/supabase-auth-client";
import { applyAuthProviderEvent } from "@/lib/auth-provider-events";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const DEV = process.env.NODE_ENV === "development";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const initDone = useRef(false);

  useEffect(() => {
    let isMounted = true;

    void getClientSession()
      .then(({ session, error }) => {
        if (!isMounted) return;

        if (DEV) {
          console.info("[AuthProvider] Initial session", {
            hasSession: Boolean(session),
            userId: session?.user?.id || null,
          });
        }

        if (error && DEV) {
          console.warn("[AuthProvider] Initial session lookup failed", error.message);
        }

        initDone.current = true;
        setInitializing(false);
      })
      .catch(() => {
        if (!isMounted) return;
        initDone.current = true;
        setInitializing(false);
      });

    const authListener = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (DEV && event !== "TOKEN_REFRESHED") {
        console.info("[AuthProvider] Auth event", { event, userId: session?.user?.id || null });
      }

      void applyAuthProviderEvent({
        event,
        session,
        refresh: () => router.refresh(),
        replace: (href) => router.replace(href),
        signOut: () => supabase.auth.signOut(),
        setLoading: (loading) => {
          if (!loading && !initDone.current) {
            initDone.current = true;
          }
          if (!loading) {
            setInitializing(false);
          }
        },
      });
    });

    const subscription = authListener?.data?.subscription;
    if (!subscription) {
      return () => {
        isMounted = false;
      };
    }

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-workspace-canvas">
        <Loader2 className="h-10 w-10 animate-spin text-brand" />
      </div>
    );
  }

  return <>{children}</>;
}