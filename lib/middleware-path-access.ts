/**
 * Role → path authorization used by the edge/proxy middleware.
 * Keep portal prefixes aligned with resolveProtectedRolePrefix / roleToPath
 * in lib/auth-routing.ts (canonical homes live under /app/*).
 */
export function canAccessPath(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!role) return false;

  // Shared protected paths accessible to all authenticated roles
  const sharedProtectedPrefixes = [
    "/app/profile",
    "/app/settings",
    "/app/messages",
    "/app/announcements",
    "/app/events",
    "/app/notifications",
  ];

  if (
    sharedProtectedPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }

  // Role-specific path restrictions
  // Legacy /app/dashboard was School Administrator home; only Head Teacher.
  if (pathname === "/dashboard" || pathname === "/app/dashboard")
    return role === "PRINCIPAL";
  if (pathname.startsWith("/app/super-admin")) return role === "SUPER_ADMIN";
  if (pathname.startsWith("/app/admin") || pathname.startsWith("/admin")) {
    return [
      "PRINCIPAL",
      "DEPUTY_HEAD",
      "BURSAR",
      "ACADEMIC_ADMIN",
      "HR_ADMIN",
      "ICT_ADMIN",
      "DISCIPLINE_ADMIN",
      "GUIDANCE_OFFICE",
      "REGISTRAR",
    ].includes(role);
  }
  if (pathname.startsWith("/app/payments") || pathname.startsWith("/payments"))
    return ["PAYMENTS", "BURSAR"].includes(role);
  if (pathname.startsWith("/app/bursar")) return role === "BURSAR";
  if (pathname.startsWith("/app/principal")) return role === "PRINCIPAL";
  if (pathname.startsWith("/app/deputy-head")) return role === "DEPUTY_HEAD";
  if (pathname.startsWith("/app/guidance")) return role === "GUIDANCE_OFFICE";
  if (pathname.startsWith("/app/academic-admin"))
    return role === "ACADEMIC_ADMIN";
  if (pathname.startsWith("/app/hr-admin")) return role === "HR_ADMIN";
  if (pathname.startsWith("/app/ict-admin")) return role === "ICT_ADMIN";
  if (pathname.startsWith("/app/registrar")) return role === "REGISTRAR";
  // Discipline desk: discipline admin owns it; guidance may use the same
  // records UI for welfare / conduct follow-up (API still enforces feature perms).
  if (pathname.startsWith("/app/discipline-admin"))
    return role === "DISCIPLINE_ADMIN" || role === "GUIDANCE_OFFICE";
  // Canonical portals live under /app/*; legacy /teacher|/student|/parent still redirect there.
  if (pathname.startsWith("/app/teacher") || pathname.startsWith("/teacher"))
    return role === "TEACHER";
  if (pathname.startsWith("/app/student") || pathname.startsWith("/student"))
    return role === "STUDENT";
  if (pathname.startsWith("/app/parent") || pathname.startsWith("/parent"))
    return role === "PARENT";

  // Default /app paths require school leadership or office staff
  if (pathname.startsWith("/app"))
    return [
      "PRINCIPAL",
      "DEPUTY_HEAD",
      "BURSAR",
      "ACADEMIC_ADMIN",
      "HR_ADMIN",
      "ICT_ADMIN",
      "DISCIPLINE_ADMIN",
      "GUIDANCE_OFFICE",
      "REGISTRAR",
    ].includes(role);

  // Allow access to all other paths
  return true;
}
