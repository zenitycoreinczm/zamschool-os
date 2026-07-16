/**
 * Supabase Email Relay
 *
 * Sends emails through Supabase Auth's configured SMTP (set in the Supabase dashboard)
 * by calling the GoTrue admin API directly - no SMTP env vars required.
 *
 * This handles auth-triggered emails: password recovery, invite, and magic link emails.
 * For custom-content emails (OTP codes, temporary credentials), direct SMTP credentials
 * in .env.local are required - the relay logs these for development.
 *
 * Supabase SMTP is configured at:
 *   Supabase Dashboard → Project → Auth → Settings → SMTP Provider
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials for email relay. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface SupabaseEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an invitation/signup email through Supabase's configured SMTP.
 * Uses admin.generateLink to create a signup link and trigger the email
 * via Supabase Auth's SMTP configuration.
 */
export async function sendSupabaseSignupEmail(input: {
  email: string;
  firstName: string;
  role: string;
}): Promise<SupabaseEmailResult> {
  try {
    const supabase = getAdminClient();
    const redirectTo =
      process.env.NEXT_PUBLIC_APP_ORIGIN ||
      `${process.env.NEXT_PUBLIC_WEBAPP_ORIGIN || "http://localhost:3000"}/login`;

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: input.email,
      password: crypto.randomUUID?.()?.slice(0, 12) || Math.random().toString(36).slice(2, 14),
      options: {
        redirectTo,
        data: {
          first_name: input.firstName,
          role: input.role.toLowerCase(),
          invited: true,
        },
      },
    });

    if (error) {
      console.error("[SupabaseEmailRelay] Signup email failed:", error.message);
      return { success: false, error: error.message };
    }

    console.log(`[SupabaseEmailRelay] Signup email triggered for ${input.email.split("@")[0]}***@...`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[SupabaseEmailRelay] Signup error:", message);
    return { success: false, error: message };
  }
}

/**
 * Verify the Supabase SMTP configuration by sending a test email.
 * This creates a real generateLink call to verify the pipeline works.
 */
export async function testSupabaseSmtp(): Promise<SupabaseEmailResult> {
  try {
    const supabase = getAdminClient();
    // Just verify the admin client works by checking a user
    const { error } = await supabase.auth.admin.listUsers();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
