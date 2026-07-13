"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDisplayName } from "@/lib/profile-utils";
import { adminApiJson } from "@/lib/admin-browser-api";
import type {
  DirectoryUser,
  ParentLinkTarget,
} from "@/components/admin/users/types";

type UseParentLinksArgs = {
  students: DirectoryUser[];
};

export function useParentLinks({ students }: UseParentLinksArgs) {
  const [openLinkModal, setOpenLinkModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<DirectoryUser | null>(
    null,
  );
  const [linkSearch, setLinkSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);

  const refreshLinkedStudentIds = useCallback(
    async (parentProfileId: string) => {
      try {
        const response = await adminApiJson<{
          data?: {
            parents?: Array<{
              profileId?: string;
              linkedStudentProfileIds?: unknown;
            }>;
          };
        }>("/api/admin/relationships");
        const parents = Array.isArray(response?.data?.parents)
          ? response.data.parents
          : [];
        const matchedParent = parents.find(
          (parent) => parent.profileId === parentProfileId,
        );
        const nextLinkedIds = Array.isArray(
          matchedParent?.linkedStudentProfileIds,
        )
          ? matchedParent.linkedStudentProfileIds.filter(
              (value): value is string =>
                typeof value === "string" && value.length > 0,
            )
          : [];
        setLinkedStudentIds(nextLinkedIds);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load linked students";
        toast.error(message);
        setLinkedStudentIds([]);
      }
    },
    [],
  );

  const openParentLinkManager = useCallback(
    async (row: DirectoryUser) => {
      setSelectedParent(row);
      setLinkSearch("");
      setOpenLinkModal(true);
      await refreshLinkedStudentIds(row.id);
    },
    [refreshLinkedStudentIds],
  );

  const toggleLinkStudent = useCallback(
    async (studentId: string, shouldLink: boolean) => {
      if (!selectedParent) return;

      setLinking(true);
      const t = toast.loading(
        shouldLink ? "Linking student..." : "Removing link...",
      );

      try {
        await adminApiJson("/api/admin/relationships", {
          method: "POST",
          body: JSON.stringify({
            action: shouldLink
              ? "link_parent_student"
              : "unlink_parent_student",
            parentProfileId: selectedParent.id,
            studentProfileId: studentId,
          }),
        });

        setLinkedStudentIds((prev) =>
          shouldLink
            ? Array.from(new Set([...prev, studentId]))
            : prev.filter((id) => id !== studentId),
        );

        toast.success(shouldLink ? "Student linked" : "Link removed", {
          id: t,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update link";
        toast.error(message, { id: t });
      } finally {
        setLinking(false);
      }
    },
    [selectedParent],
  );

  const linkCandidates = useMemo<ParentLinkTarget[]>(() => {
    const all = students.map((s) => ({
      id: s.id,
      name: getDisplayName(s),
      admission: s.admission_number || undefined,
    }));

    const q = linkSearch.trim().toLowerCase();
    if (!q) return all;

    return all.filter((s) =>
      `${s.name} ${s.admission || ""}`.toLowerCase().includes(q),
    );
  }, [students, linkSearch]);

  return {
    openLinkModal,
    setOpenLinkModal,
    selectedParent,
    linkCandidates,
    linkedStudentIds,
    linkSearch,
    setLinkSearch,
    linking,
    openParentLinkManager,
    toggleLinkStudent,
  };
}
