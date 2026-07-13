"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Surface } from "@/components/workspace/Surface";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";
import { ChevronRight } from "lucide-react";

type Child = {
  id: string;
  displayName: string;
  admissionNumber: string | null;
  classId: string | null;
  className: string | null;
  relationship: string | null;
  email: string | null;
};

export default function ParentChildrenPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;

    const load = async () => {
      const res = await fetch("/api/parent/children");

      if (res.ok) {
        const body = await res.json();
        setChildren(body.data ?? []);
      }
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) return <WorkspaceLoader label="Loading children" />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">My Children</h1>
        <p className="text-sm text-slate-500">
          {children.length} linked student{children.length !== 1 ? "s" : ""}
        </p>
      </div>

      {children.length === 0 ? (
        <Surface variant="elevated" className="p-8 text-center">
          <p className="text-sm text-slate-500">
            No children linked to your account yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Contact the school administrator to link your children.
          </p>
        </Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child) => (
            <Link
              key={child.id}
              href={`/parent/attendance?studentId=${child.id}`}
            >
              <Surface
                variant="elevated"
                className="group cursor-pointer p-5 transition hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
                    {child.displayName.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {child.displayName}
                    </p>
                    {child.className && (
                      <p className="text-xs text-slate-500">
                        {child.className}
                      </p>
                    )}
                    {child.admissionNumber && (
                      <p className="text-xs text-slate-400">
                        {child.admissionNumber}
                      </p>
                    )}
                    {child.relationship && (
                      <p className="text-[11px] font-medium text-teal-600">
                        {child.relationship}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-teal-500" />
                </div>
              </Surface>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
