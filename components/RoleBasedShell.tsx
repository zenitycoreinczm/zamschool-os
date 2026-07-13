"use client";

import dynamic from "next/dynamic";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { Surface } from "@/components/workspace/Surface";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

const shellFallback = () => (
  <WorkspaceLoader
    label="Loading workspace"
    hint="Opening your school portal"
  />
);

const AdminShell = dynamic(() => import("@/components/AdminShell"), {
  loading: shellFallback,
});
const TeacherShell = dynamic(() => import("@/components/TeacherShell"), {
  loading: shellFallback,
});
const PaymentsShell = dynamic(() => import("@/components/PaymentsShell"), {
  loading: shellFallback,
});
const ParentShell = dynamic(() => import("@/components/ParentShell"), {
  loading: shellFallback,
});
const StudentShell = dynamic(() => import("@/components/StudentShell"), {
  loading: shellFallback,
});

/** Roles that intentionally use AdminShell (school staff + platform). */
const ADMIN_SHELL_ROLES = new Set([
  "principal",
  "deputy_head",
  "guidance_office",
  "academic_admin",
  "hr_admin",
  "ict_admin",
  "discipline_admin",
  "registrar",
  // Platform operator: uses AdminShell chrome + super-admin nav (not a gap).
  "super_admin",
  // Legacy alias collapsed into principal; keep mapped so we never warn.
  "admin",
]);

/** Warn once per role per page session — never spam React re-renders. */
const warnedUnmappedRoles = new Set<string>();

export default function RoleBasedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspaceCtx = useWorkspaceContext() ?? undefined;
  const role = workspaceCtx?.role ?? null;
  const loading = workspaceCtx?.loading ?? true;
  const error = workspaceCtx?.error ?? "";

  if (loading) {
    return (
      <WorkspaceLoader
        label="Loading workspace"
        hint="Opening your school portal"
      />
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "grid h-screen w-full place-items-center px-6",
          ws.canvas,
        )}
      >
        <Surface variant="elevated" className="max-w-md p-6 text-center">
          <p className="text-sm font-medium text-rose-600">{error}</p>
        </Surface>
      </div>
    );
  }

  if (role === "teacher") {
    return <TeacherShell>{children}</TeacherShell>;
  }

  if (role === "payments" || role === "bursar") {
    return <PaymentsShell>{children}</PaymentsShell>;
  }

  if (role === "parent") {
    return <ParentShell>{children}</ParentShell>;
  }

  if (role === "student") {
    return <StudentShell>{children}</StudentShell>;
  }

  if (role && ADMIN_SHELL_ROLES.has(role)) {
    return <AdminShell>{children}</AdminShell>;
  }

  // Truly unknown role only — log once so audits still catch gaps.
  if (typeof window !== "undefined" && role && !warnedUnmappedRoles.has(role)) {
    warnedUnmappedRoles.add(role);
    // eslint-disable-next-line no-console
    console.warn(
      `[RoleBasedShell] No shell mapped for role "${role}". Falling back to AdminShell.`,
    );
  }
  return <AdminShell>{children}</AdminShell>;
}
