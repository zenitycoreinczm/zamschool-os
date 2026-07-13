/**
 * Thin typed wrappers around the existing admin API endpoints.
 * All registrar pages use these so the fetch logic stays in one place.
 */

import {
  adminDelete,
  adminGet,
  adminPost,
  adminRequest,
} from "@/lib/admin-route-client";

export type ClassOption = { id: string; label: string };
export type SubjectOption = { id: string; label: string };

export type ProfileRow = Record<string, any>;

export type ClassRow = {
  id: string;
  name: string;
  grade_level?: number | null;
  capacity?: number | null;
  supervisor_id?: string | null;
  grades?: { name?: string; level?: number | null } | null;
  profiles?: { first_name?: string; last_name?: string; email?: string } | null;
};

export type RelationshipData = {
  students: Array<{
    profileId: string;
    displayName: string;
    email: string | null;
    admissionNumber: string | null;
    classId: string | null;
    className: string;
  }>;
  teachers: Array<{
    profileId: string;
    displayName: string;
    email: string | null;
    employeeId: string | null;
  }>;
  parents: Array<{
    profileId: string;
    displayName: string;
    email: string | null;
    relationType: string | null;
    linkedStudentProfileIds: string[];
  }>;
  classes: Array<{
    id: string;
    name: string;
    gradeLabel: string;
    supervisorId: string | null;
    supervisorName: string;
  }>;
};

// ── Users ────────────────────────────────────────────────────────────────────

export async function fetchUsers(): Promise<{
  students: ProfileRow[];
  teachers: ProfileRow[];
  parents: ProfileRow[];
}> {
  const body = (await adminGet("/api/admin/users")) as { data?: any };
  return {
    students: body.data?.students ?? [],
    teachers: body.data?.teachers ?? [],
    parents: body.data?.parents ?? [],
  };
}

export async function createUser(payload: Record<string, unknown>) {
  return adminPost("/api/admin/users", payload) as Promise<{
    temporaryPassword?: string;
    credentialsEmailSent?: boolean;
  }>;
}

export async function updateUser(payload: Record<string, unknown>) {
  return adminRequest("/api/admin/users", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteUser(profileId: string, role: string) {
  return adminDelete(
    `/api/admin/users?profileId=${encodeURIComponent(profileId)}&role=${role}`,
  );
}

// ── Classes ──────────────────────────────────────────────────────────────────

export async function fetchClasses(): Promise<ClassRow[]> {
  const body = (await adminGet("/api/admin/classes")) as { data?: ClassRow[] };
  return Array.isArray(body.data) ? body.data : [];
}

export async function createClass(payload: Record<string, unknown>) {
  return adminPost("/api/admin/classes", payload) as Promise<{ data?: ClassRow }>;
}

export async function updateClass(payload: Record<string, unknown>) {
  return adminRequest("/api/admin/classes", {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

export async function deleteClass(id: string) {
  return adminDelete(`/api/admin/classes?id=${encodeURIComponent(id)}`);
}

// ── Subjects ─────────────────────────────────────────────────────────────────

export async function fetchSubjects(): Promise<SubjectOption[]> {
  const body = (await adminGet("/api/admin/subjects")) as { data?: Array<Record<string, unknown>> };
  return Array.isArray(body.data)
    ? body.data.flatMap((row: Record<string, unknown>) => {
        const id = typeof row?.id === "string" ? row.id : "";
        const name = typeof row?.name === "string" ? row.name.trim() : "";
        return id && name ? [{ id, label: name }] : [];
      })
    : [];
}

export async function createSubject(payload: Record<string, unknown>) {
  return adminPost("/api/admin/subjects", payload);
}

// ── Relationships ─────────────────────────────────────────────────────────────

export async function fetchRelationships(): Promise<RelationshipData> {
  const body = (await adminGet("/api/admin/relationships")) as {
    data?: RelationshipData;
  };
  return (
    body.data ?? { students: [], teachers: [], parents: [], classes: [] }
  );
}

export async function postRelationship(payload: Record<string, unknown>) {
  return adminPost("/api/admin/relationships", payload);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function toClassOptions(rows: ClassRow[]): ClassOption[] {
  return rows.flatMap((row) => {
    const id = typeof row?.id === "string" ? row.id : "";
    const className = typeof row?.name === "string" ? row.name.trim() : "";
    const gradeName =
      typeof row?.grades?.name === "string" ? row.grades.name.trim() : "";
    const label =
      [gradeName, className].filter(Boolean).join(" - ") ||
      className ||
      gradeName;
    return id && label ? [{ id, label }] : [];
  });
}