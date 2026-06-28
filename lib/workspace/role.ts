import { normalizeRole } from "@/lib/roles";

export type AppWorkspaceRole =
  | "admin"
  | "teacher"
  | "payments"
  | "student"
  | "parent"
  | "principal"
  | "deputy_head"
  | "bursar"
  | "guidance_office"
  | "academic_admin"
  | "hr_admin"
  | "ict_admin"
  | "discipline_admin"
  | "registrar"
  | "super_admin"
  | null;

export function normalizeAppWorkspaceRole(role: unknown): AppWorkspaceRole {
  const normalized = normalizeRole(String(role || ""));
  return normalized ? (normalized.toLowerCase() as AppWorkspaceRole) : null;
}
