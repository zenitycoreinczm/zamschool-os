"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { TimetableWorkspace } from "@/components/timetable/TimetableWorkspace";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { normalizeRole } from "@/lib/roles";

export default function AdminTimetablePage() {
  const wsData = useWorkspaceContext()?.data ?? null;
  const role = normalizeRole(wsData?.role);
  const router = useRouter();

  useEffect(() => {
    if (role && role !== "TEACHER") {
      router.replace("/app/admin/timetable/classes");
    }
  }, [role, router]);

  if (role === "TEACHER") {
    return <TimetableWorkspace viewMode="self" />;
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
      Loading timetable...
    </div>
  );
}