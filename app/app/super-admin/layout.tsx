import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/roles";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/app/super-admin");
  }

  // Match middleware profile resolution: id, auth_user_id, or email.
  // Restricting to id alone returned no row for some platform accounts and
  // bounced super-admins to login / access_denied.
  const email = String(user.email || "").trim();
  const orFilter = email
    ? `id.eq.${user.id},auth_user_id.eq.${user.id},email.eq.${email}`
    : `id.eq.${user.id},auth_user_id.eq.${user.id}`;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  const role = normalizeRole(profile?.role);
  if (role !== "SUPER_ADMIN") {
    redirect("/login?error=access_denied");
  }

  return <>{children}</>;
}
