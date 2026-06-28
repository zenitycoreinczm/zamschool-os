"use client";

import dynamic from "next/dynamic";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { Surface } from "@/components/workspace/Surface";
import { useWorkspaceContext } from "@/components/WorkspaceContextProvider";
import { ws } from "@/lib/workspace/design";
import { cn } from "@/lib/utils";

const shellFallback = () => <WorkspaceLoader label="Loading workspace" />;

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

export default function RoleBasedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { role, loading, error } = useWorkspaceContext();

  if (loading) {
    return <WorkspaceLoader label="Loading workspace" />;
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

  if (
    role === "principal" ||
    role === "deputy_head" ||
    role === "guidance_office" ||
    role === "academic_admin" ||
    role === "hr_admin" ||
    role === "ict_admin" ||
    role === "discipline_admin" ||
    role === "registrar"
  ) {
    return <AdminShell>{children}</AdminShell>;
  }

  if (role === "student") {
    return <StudentShell>{children}</StudentShell>;
  }

  return <AdminShell>{children}</AdminShell>;
}
