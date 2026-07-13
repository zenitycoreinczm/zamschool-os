import { normalizeRole, type KnownRole } from "@/lib/roles";
import type { FeatureAction } from "@/lib/feature-permissions";

export type SchoolDomain =
  | "people"
  | "registry"
  | "academic"
  | "quality"
  | "governance"
  | "system"
  | "discipline"
  | "finance"
  | "teaching";

export type DomainAction = FeatureAction | "review" | "approve" | "publish";

export const DOMAIN_OWNERS: Record<SchoolDomain, KnownRole[]> = {
  people: ["HR_ADMIN"],
  registry: ["REGISTRAR"],
  academic: ["ACADEMIC_ADMIN"],
  quality: ["DEPUTY_HEAD"],
  governance: ["PRINCIPAL"],
  system: ["ICT_ADMIN"],
  discipline: ["DISCIPLINE_ADMIN", "GUIDANCE_OFFICE"],
  finance: ["BURSAR", "PAYMENTS", "PRINCIPAL"],
  teaching: ["TEACHER"],
};

const DOMAIN_REVIEWERS: Partial<Record<SchoolDomain, KnownRole[]>> = {
  academic: ["DEPUTY_HEAD"],
  discipline: ["DEPUTY_HEAD", "PRINCIPAL"],
  finance: ["PRINCIPAL"],
  people: ["PRINCIPAL"],
  registry: ["PRINCIPAL", "DEPUTY_HEAD"],
};

const FINAL_AUTHORITY_DOMAINS = new Set<SchoolDomain>([
  "academic",
  "quality",
  "discipline",
  "finance",
  "registry",
  "people",
]);

export function domainOwnsRole(
  domain: SchoolDomain,
  role: string | null | undefined,
): boolean {
  const normalized = normalizeRole(role);
  return Boolean(normalized && DOMAIN_OWNERS[domain].includes(normalized));
}

export function canRoleAccessDomain(
  domain: SchoolDomain,
  role: string | null | undefined,
  action: DomainAction = "read",
): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  if (normalized === "SUPER_ADMIN") return true;

  if (action === "read") {
    return (
      normalized === "PRINCIPAL" ||
      domainOwnsRole(domain, normalized) ||
      Boolean(DOMAIN_REVIEWERS[domain]?.includes(normalized))
    );
  }

  if (action === "review") {
    return (
      domainOwnsRole(domain, normalized) ||
      Boolean(DOMAIN_REVIEWERS[domain]?.includes(normalized))
    );
  }

  if (action === "approve" || action === "publish") {
    return (
      normalized === "PRINCIPAL" && FINAL_AUTHORITY_DOMAINS.has(domain)
    );
  }

  // Create/update/delete are domain-owner operations. Head Teacher may also
  // write people structure (e.g. departments) when HR is not yet on staff.
  if (normalized === "PRINCIPAL" && domain === "people") {
    return true;
  }

  return domainOwnsRole(domain, normalized);
}

export function assertDomainAccess(input: {
  domain: SchoolDomain;
  role: string | null | undefined;
  action?: DomainAction;
}): { ok: true } | { ok: false; error: string } {
  const action = input.action ?? "read";
  if (canRoleAccessDomain(input.domain, input.role, action)) {
    return { ok: true };
  }

  return {
    ok: false,
    error: `This ${action} action belongs to the ${input.domain} domain`,
  };
}
