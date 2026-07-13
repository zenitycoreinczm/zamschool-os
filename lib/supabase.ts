import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCookieBackedBrowserClient } from "./supabase-browser-client";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

const isBuildTime = typeof window === "undefined" && process.env.NEXT_PHASE === "phase-production-build";

if (!supabaseUrl || !supabaseAnonKey) {
  if (!isBuildTime) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }
}

const isBrowser = typeof window !== "undefined";
const createSupabaseClient = () => createClient(supabaseUrl, supabaseAnonKey);
type SupabaseBrowserClient = ReturnType<typeof createSupabaseClient>;

export const supabase: SupabaseBrowserClient = isBrowser
  ? createCookieBackedBrowserClient<SupabaseBrowserClient>({
      storage: globalThis as Record<string, unknown>,
      supabaseUrl,
      supabaseAnonKey,
    })
  : supabaseUrl && supabaseAnonKey
    ? createSupabaseClient()
    : (null as unknown as SupabaseBrowserClient);

// Admin client for server-side operations that bypass RLS.
// In the browser we must not create a second auth client with the same storage key.
export const supabaseAdmin = isBrowser
  ? supabase
  : supabaseUrl && !isBuildTime
    ? getSupabaseAdmin()
    : (null as unknown as ReturnType<typeof createClient>);

export type UserRole =
  | "PRINCIPAL"
  | "TEACHER"
  | "STUDENT"
  | "PARENT"
  | "DEPUTY_HEAD"
  | "SUPER_ADMIN";

export interface Profile {
  id: string;
  school_id: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  // Expanded fields
  admission_number?: string; // For students
  employee_id?: string; // For teachers
  parent_id?: string; // For students linkage
  gender?: "MALE" | "FEMALE" | "OTHER";
  date_of_birth?: string;
  grade_id?: string;
  class_id?: string;
  status?: "ACTIVE" | "INACTIVE" | "TRANSFERRED" | "WITHDRAWN";
  emergency_contact?: string;
  medical_notes?: string;
  subjects?: string[]; // For teachers
  classes?: string[]; // For teachers
}

export interface School {
  id: string;
  name: string;
  code: string;
  address?: string;
  logo_url?: string;
  created_at: string;
}
