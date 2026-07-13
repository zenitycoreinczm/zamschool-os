"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getDisplayName } from "@/lib/profile-utils";
import { adminApiJson } from "@/lib/admin-browser-api";
import { useWorkspaceContext } from "@/components/workspace/workspace-context";
import { schoolLinkUserMessage } from "@/lib/school-access-error";
import { normalizeRole } from "@/lib/roles";
import {
  PAGE_SIZE,
  USERS_CONSOLE_ALLOWED_ROLES,
  USERS_CONSOLE_DEFAULT_TEACHERS_TAB,
  USERS_RECOVERY_ROLES,
  adminSubtypeHomePath,
  type ClassOption,
  type DirectoryUser,
  type ParentMeta,
  type SubjectOption,
  type TabKey,
} from "@/components/admin/users/types";
import {
  countActiveUsers,
  filterDirectoryRows,
  sortOptionList,
  tabToManagedRole,
  toClassOptions,
} from "@/components/admin/users/helpers";

export function useUsersDirectory() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    role: workspaceRole,
    data: workspaceData,
    loading: workspaceLoading,
  } = useWorkspaceContext();
  const normalizedWorkspaceRole = normalizeRole(workspaceRole);
  const workspaceSchoolId = String(workspaceData?.schoolId || "").trim() || null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = normalizedWorkspaceRole;
    if (!role) return;
    if (USERS_CONSOLE_ALLOWED_ROLES.has(role)) return;
    const fallback = adminSubtypeHomePath(role);
    if (fallback && fallback !== "/app/admin/users") {
      router.replace(fallback);
    }
  }, [normalizedWorkspaceRole, router]);

  const isRecoveryConsole = Boolean(
    normalizedWorkspaceRole &&
      USERS_RECOVERY_ROLES.has(normalizedWorkspaceRole),
  );
  const canInviteStaff =
    normalizedWorkspaceRole === "PRINCIPAL" ||
    normalizedWorkspaceRole === "SUPER_ADMIN";
  const isHrConsole = normalizedWorkspaceRole === "HR_ADMIN";
  /** HR maintains records only — never creates or deletes accounts. */
  const canCreateUsers = !isHrConsole && !isRecoveryConsole;
  const canDeleteUsers = !isHrConsole && !isRecoveryConsole;

  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    normalizedWorkspaceRole &&
    USERS_CONSOLE_DEFAULT_TEACHERS_TAB.has(normalizedWorkspaceRole)
      ? "teachers"
      : "students",
  );

  // HR (and ICT recovery) stay on staff-focused Teachers tab.
  useEffect(() => {
    if (
      normalizedWorkspaceRole &&
      USERS_CONSOLE_DEFAULT_TEACHERS_TAB.has(normalizedWorkspaceRole)
    ) {
      setActiveTab("teachers");
    }
  }, [normalizedWorkspaceRole]);
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);
  const [students, setStudents] = useState<DirectoryUser[]>([]);
  const [teachers, setTeachers] = useState<DirectoryUser[]>([]);
  const [parentsProfiles, setParentsProfiles] = useState<DirectoryUser[]>([]);
  const [parentsMetaMap, setParentsMetaMap] = useState<
    Record<string, ParentMeta>
  >({});
  const [pageByTab, setPageByTab] = useState<Record<TabKey, number>>({
    students: 1,
    teachers: 1,
    parents: 1,
  });
  const [parentsTable, setParentsTable] = useState<string | null>(null);
  const [parentStudentsTable, setParentStudentsTable] = useState<string | null>(
    null,
  );
  const [staffInvitesExpanded, setStaffInvitesExpanded] = useState(true);
  const [departmentNames, setDepartmentNames] = useState<string[]>([]);

  const classNameById = useMemo(
    () =>
      Object.fromEntries(
        classOptions.map((option) => [option.id, option.label]),
      ),
    [classOptions],
  );
  const subjectNameById = useMemo(
    () =>
      Object.fromEntries(
        subjectOptions.map((option) => [option.id, option.label]),
      ),
    [subjectOptions],
  );

  useEffect(() => {
    const nextQuery = (searchParams.get("q") || "").trim();
    if (nextQuery) setSearch(nextQuery);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      250,
    );
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClassOptions = useCallback(async () => {
    try {
      const body = await adminApiJson<{ data?: unknown[] }>(
        "/api/admin/classes",
      );
      const options = toClassOptions(body?.data);
      setClassOptions(options);
      return options;
    } catch {
      // HR and other limited roles may lack classes:read — directory still works.
      setClassOptions([]);
      return [] as ClassOption[];
    }
  }, []);

  const fetchSubjectOptions = useCallback(async () => {
    try {
      const body = await adminApiJson<{ data?: unknown[] }>(
        "/api/admin/subjects",
      );
      const options = Array.isArray(body?.data)
        ? body.data.flatMap((row) => {
            const item = row as { id?: unknown; name?: unknown };
            const id = typeof item?.id === "string" ? item.id : "";
            const name =
              typeof item?.name === "string" ? item.name.trim() : "";
            return id && name ? [{ id, label: name }] : [];
          })
        : [];
      setSubjectOptions(options);
      return options;
    } catch {
      setSubjectOptions([]);
      return [] as SubjectOption[];
    }
  }, []);

  const fetchDepartmentNames = useCallback(async () => {
    try {
      const body = await adminApiJson<{
        data?: Array<{ name?: string | null }>;
      }>("/api/school/departments");
      const names = Array.isArray(body?.data)
        ? body.data
            .map((row) => String(row?.name || "").trim())
            .filter(Boolean)
        : [];
      // Unique, sorted for the employment form select.
      const unique = Array.from(new Set(names)).sort((a, b) =>
        a.localeCompare(b),
      );
      setDepartmentNames(unique);
      return unique;
    } catch {
      setDepartmentNames([]);
      return [] as string[];
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const body = await adminApiJson<{
      data?: {
        students?: DirectoryUser[];
        teachers?: DirectoryUser[];
        parents?: DirectoryUser[];
        parentRows?: ParentMeta[];
      };
    }>("/api/admin/users");

    setStudents(body.data?.students || []);
    setTeachers(body.data?.teachers || []);
    setParentsProfiles(body.data?.parents || []);

    if (Array.isArray(body.data?.parentRows)) {
      const mapped: Record<string, ParentMeta> = {};
      for (const row of body.data.parentRows || []) {
        const key =
          typeof row.profile_id === "string" ? row.profile_id : undefined;
        if (key) mapped[key] = row;
      }
      setParentsMetaMap(mapped);
    } else {
      setParentsMetaMap({});
    }
  }, []);

  useEffect(() => {
    const role = normalizedWorkspaceRole;
    if (!role || !USERS_CONSOLE_ALLOWED_ROLES.has(role)) return;

    // Wait for workspace context before hard-failing on missing school.
    if (workspaceLoading && !workspaceSchoolId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Prefer shell context schoolId (already resolved) before extra API hops.
        let sid = workspaceSchoolId;

        if (!sid) {
          const schoolBody = await adminApiJson<{
            data?: { profile?: { school_id?: string | null } };
          }>("/api/admin/school");
          sid = String(schoolBody.data?.profile?.school_id || "").trim() || null;
        }

        if (!sid) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const retryBody = await adminApiJson<{
            data?: { profile?: { school_id?: string | null } };
          }>("/api/admin/school");
          sid = String(retryBody.data?.profile?.school_id || "").trim() || null;
        }

        if (!sid) {
          throw new Error(schoolLinkUserMessage());
        }
        if (cancelled) return;

        setSchoolId(sid);
        setParentsTable("parents");
        setParentStudentsTable("parent_students");

        await Promise.all([
          fetchClassOptions(),
          fetchSubjectOptions(),
          fetchDepartmentNames(),
        ]);
        if (cancelled) return;
        await fetchAll();
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : "Failed to load users";
          toast.error(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    normalizedWorkspaceRole,
    workspaceLoading,
    workspaceSchoolId,
    fetchAll,
    fetchClassOptions,
    fetchSubjectOptions,
    fetchDepartmentNames,
  ]);

  const currentRows = useMemo(() => {
    const rows =
      activeTab === "students"
        ? students
        : activeTab === "teachers"
          ? teachers
          : parentsProfiles;
    return filterDirectoryRows(rows, debouncedSearch, classNameById);
  }, [
    activeTab,
    students,
    teachers,
    parentsProfiles,
    debouncedSearch,
    classNameById,
  ]);

  const paginatedRows = useMemo(() => {
    const page = pageByTab[activeTab] || 1;
    const start = (page - 1) * PAGE_SIZE;
    return currentRows.slice(start, start + PAGE_SIZE);
  }, [currentRows, pageByTab, activeTab]);

  const totalPages = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE));

  const accountOverview = useMemo(
    () => ({
      students: students.length,
      teachers: teachers.length,
      parents: parentsProfiles.length,
      activeStudents: countActiveUsers(students),
      activeTeachers: countActiveUsers(teachers),
      activeParents: countActiveUsers(parentsProfiles),
      incompleteEmployment: teachers.filter(
        (row) =>
          !String(row.employee_id || "").trim() ||
          !String(row.department || "").trim() ||
          !String(row.hire_date || "").trim(),
      ).length,
    }),
    [students, teachers, parentsProfiles],
  );

  useEffect(() => {
    if ((pageByTab[activeTab] || 1) > totalPages) {
      setPageByTab((prev) => ({ ...prev, [activeTab]: totalPages }));
    }
  }, [activeTab, pageByTab, totalPages]);

  const handleDelete = useCallback(
    async (row: DirectoryUser) => {
      if (!schoolId) return;
      if (!canDeleteUsers) {
        toast.error(
          "HR cannot delete accounts. Contact the Head Teacher or ICT if an account must be removed.",
        );
        return;
      }
      const ok = window.confirm(
        `Delete ${getDisplayName(row)}? This action cannot be undone.`,
      );
      if (!ok) return;

      setDeleting(row.id);
      const t = toast.loading("Deleting user...");
      try {
        const role = tabToManagedRole(activeTab);
        await adminApiJson(
          `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=${role}`,
          { method: "DELETE" },
        );
        await fetchAll();
        toast.success("User deleted", { id: t });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to delete user";
        toast.error(message, { id: t });
      } finally {
        setDeleting(null);
      }
    },
    [schoolId, activeTab, fetchAll, canDeleteUsers],
  );

  const quickToggleStatus = useCallback(
    async (row: DirectoryUser) => {
      if (!schoolId) return;
      const current = String(row.status || "ACTIVE").toUpperCase();
      const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";

      try {
        await adminApiJson("/api/admin/users", {
          method: "PUT",
          body: JSON.stringify({
            profileId: row.id,
            role: tabToManagedRole(activeTab),
            firstName: row.first_name || "",
            lastName: row.last_name || "",
            email: row.email || "",
            phone: row.phone || null,
            gender: row.gender || null,
            status: next,
            admissionNumber: row.admission_number || null,
            classId: row.class_id || null,
            enrollmentDate: row.enrollment_date || null,
            employeeId: row.employee_id || null,
            department: row.department || null,
            specialization: row.specialization || null,
            hireDate: row.hire_date || null,
            relationType: row.relation_type || null,
            occupation: row.occupation || null,
          }),
        });
        await fetchAll();
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to update status";
        toast.error(message);
      }
    },
    [schoolId, activeTab, fetchAll],
  );

  const addClassOption = useCallback((option: ClassOption) => {
    setClassOptions((current) => sortOptionList([...current, option]));
  }, []);

  const addSubjectOption = useCallback((option: SubjectOption) => {
    setSubjectOptions((current) => sortOptionList([...current, option]));
  }, []);

  return {
    isRecoveryConsole,
    canInviteStaff,
    isHrConsole,
    canCreateUsers,
    canDeleteUsers,
    loading,
    deleting,
    activeTab,
    setActiveTab,
    schoolId,
    search,
    setSearch,
    pageByTab,
    setPageByTab,
    classOptions,
    subjectOptions,
    departmentNames,
    students,
    teachers,
    parentsProfiles,
    parentsMetaMap,
    parentsTable,
    parentStudentsTable,
    classNameById,
    subjectNameById,
    currentRows,
    paginatedRows,
    totalPages,
    accountOverview,
    staffInvitesExpanded,
    setStaffInvitesExpanded,
    fetchAll,
    handleDelete,
    quickToggleStatus,
    addClassOption,
    addSubjectOption,
  };
}
