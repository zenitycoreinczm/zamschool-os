"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";
import {
  SCHOOL_ADMINISTRATOR_INVITE_ROLE,
  STAFF_INVITE_ROLE_OPTIONS,
  getStaffInviteRoleLabel,
  type StaffInviteRoleOption,
  type StaffInviteRoleValue,
} from "@/lib/staff-invite-options";

type InvitationRow = {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  role: string;
  created_at?: string | null;
  expires_at?: string | null;
  department?: string | null;
  position?: string | null;
};

type InviteForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: StaffInviteRoleValue;
  department: string;
  position: string;
};

const EMPTY_FORM: InviteForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: SCHOOL_ADMINISTRATOR_INVITE_ROLE,
  department: "",
  position: "",
};

type IssuedInvite = {
  email: string;
  role: string;
  temporaryPassword?: string;
  credentialsEmailSent?: boolean;
};

type StaffInvitePanelProps = {
  id?: string;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  roleOptions?: StaffInviteRoleOption[];
  eyebrow?: string;
  title?: string;
  description?: string;
  primaryInviteLabel?: string;
  secondaryInviteLabel?: string;
  accent?: "sky" | "teal" | "indigo" | "amber" | "emerald" | "violet" | "rose" | "slate" | "green";
};

export function StaffInvitePanel({
  id = "staff-invitations",
  expanded: expandedProp,
  onExpandedChange,
  roleOptions = STAFF_INVITE_ROLE_OPTIONS,
  eyebrow = "Staff access",
  title = "Staff & leadership accounts",
  description = "Create Deputy Head, Bursar, School Administrator, ICT, HR, and other office logins instantly. Each person gets a temporary password — share it in person or by phone. They will sign in and change it on first login. For students, parents, and classroom teachers, use the tabs below instead.",
  primaryInviteLabel = "Invite School Administrator",
  secondaryInviteLabel = "Invite other staff",
  accent = "emerald",
}: StaffInvitePanelProps = {}) {
  const defaultRole = roleOptions[0]?.value || SCHOOL_ADMINISTRATOR_INVITE_ROLE;
  const [expandedInternal, setExpandedInternal] = useState(true);
  const expanded = expandedProp ?? expandedInternal;
  const setExpanded = (value: boolean) => {
    if (expandedProp !== undefined) {
      onExpandedChange?.(value);
      return;
    }
    setExpandedInternal(value);
  };

  const [showForm, setShowForm] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [form, setForm] = useState<InviteForm>({
    ...EMPTY_FORM,
    role: defaultRole,
  });
  const [issued, setIssued] = useState<IssuedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedRoleHint = useMemo(
    () =>
      roleOptions.find((option) => option.value === form.role)?.hint || "",
    [form.role, roleOptions],
  );

  const loadInvitations = useCallback(async () => {
    setLoadingList(true);
    try {
      const body = await adminApiJson<{ data?: InvitationRow[] }>(
        "/api/staff/invitations?status=pending",
      );
      setInvitations(Array.isArray(body.data) ? body.data : []);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load invitations",
      );
      setInvitations([]);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  function openSchoolAdministratorInvite() {
    setExpanded(true);
    setShowForm(true);
    setIssued(null);
    setForm({ ...EMPTY_FORM, role: defaultRole });
  }

  function openStaffInvite(
    role: StaffInviteRoleValue = defaultRole,
  ) {
    setExpanded(true);
    setShowForm(true);
    setIssued(null);
    setForm({ ...EMPTY_FORM, role });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const first_name = form.first_name.trim();
    const last_name = form.last_name.trim();
    const email = form.email.trim().toLowerCase();

    if (!first_name || !last_name || !email) {
      toast.error("First name, last name, and email are required.");
      return;
    }

    setSubmitting(true);
    try {
      const body = await adminApiJson<{
        data?: {
          email?: string;
          role?: string;
          temporary_password?: string;
          credentials_email_sent?: boolean;
        };
      }>("/api/staff/invitations", {
        method: "POST",
        body: JSON.stringify({
          first_name,
          last_name,
          email,
          phone: form.phone.trim() || undefined,
          role: form.role,
          department: form.department.trim() || undefined,
          position: form.position.trim() || undefined,
          send_email: false,
        }),
      });

      setIssued({
        email: body.data?.email || email,
        role: body.data?.role || form.role,
        temporaryPassword: body.data?.temporary_password,
        credentialsEmailSent: body.data?.credentials_email_sent === true,
      });
      setForm({ ...EMPTY_FORM, role: defaultRole });
      setForm(EMPTY_FORM);
      toast.success("Staff account created — share the temporary password below.");
      await loadInvitations();
      toast.error(
        err instanceof Error ? err.message : "Failed to create staff account",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard — select and copy manually.");
    }
  }

  async function revokeInvitation(id: string) {
    setRevokingId(id);
    try {
      await adminApiJson(
        `/api/staff/invitations?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        },
      );
      toast.success("Invitation revoked");
      await loadInvitations();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke invitation",
      );
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-workspace-xl border border-workspace-border bg-white shadow-workspace-sm"
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 border-b border-workspace-border px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ws-eyebrow text-emerald-600">{eyebrow}</p>
          <h2 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-workspace-muted">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2.5">
          <button
            type="button"
            onClick={openSchoolAdministratorInvite}
            className="inline-flex items-center gap-2 rounded-workspace-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" />
            {primaryInviteLabel}
          </button>

          <button
            type="button"
            onClick={() => openStaffInvite()}
            className="inline-flex items-center gap-2 rounded-workspace-md border border-workspace-border bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-workspace-xs transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
          >
            <UserPlus className="h-4 w-4" />
            {secondaryInviteLabel}
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm font-medium text-slate-500 shadow-workspace-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-[0.98]"
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Expand
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      {expanded && (
        <div className="space-y-6 px-6 py-5">
          {/* ─── Success banner ──────────────────────────────────────── */}
          {issued && (
            <div className="rounded-workspace-lg border border-emerald-200 bg-emerald-50/70 px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-900">
                      Staff account created
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                      <span className="font-semibold">
                        {getStaffInviteRoleLabel(issued.role)}
                      </span>{" "}
                      account is ready for{" "}
                      <span className="font-semibold">{issued.email}</span>.
                      {issued.credentialsEmailSent
                        ? " Credentials have been emailed."
                        : " Share the temporary password below — they will change it on first login."}
                    </p>

                    {issued.temporaryPassword && (
                      <div className={cn("mt-3 rounded-workspace-md border px-4 py-3", palette.surfaceBorder, palette.subBg)}>
                        <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", palette.subText)}>
                          <KeyRound className="h-3.5 w-3.5" />
                          Temporary password
                        </div>
                        <div className="mt-1.5 flex items-center gap-3">
                          <code className="select-all font-mono text-base font-bold text-slate-900">
                            {issued.temporaryPassword}
                          </code>
                          <button
                            type="button"
                            onClick={() => void copyToClipboard(issued.temporaryPassword!)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-workspace-md border px-2.5 py-1.5 text-xs font-semibold transition active:scale-[0.98]",
                              palette.chip,
                              palette.chipBorder,
                              palette.chipHover,
                            )}
                          >
                            {copied ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Sign in at{" "}
                          <span className="font-semibold text-slate-700">
                            /login
                          </span>{" "}
                          with this email and password, then choose a new
                          password to activate the account.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIssued(null)}
                  className={cn(
                    "shrink-0 rounded-workspace-md border px-3.5 py-2 text-sm font-medium shadow-workspace-xs transition active:scale-[0.98]",
                    palette.dismissBorder,
                    palette.dismissBg,
                    palette.dismissText,
                    palette.dismissHoverBg,
                    palette.dismissHoverText,
                  )}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ─── Invite form ─────────────────────────────────────────── */}
          {showForm && (
            <form
              onSubmit={onSubmit}
              className="rounded-workspace-lg border border-workspace-border bg-slate-50/70 p-6 shadow-workspace-xs"
            >
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-slate-900">
                    {form.role === defaultRole
                      ? primaryInviteLabel
                      : "Invite staff member"}
                  </h3>
                  {selectedRoleHint && (
                    <p className="mt-1 text-sm text-workspace-muted">
                      {selectedRoleHint}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm({ ...EMPTY_FORM, role: defaultRole });
                  }}
                  className="rounded-workspace-md p-2 text-slate-400 transition hover:bg-white hover:text-slate-600"
                  aria-label="Close invite form"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    First name
                  </span>
                  <input
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        first_name: e.target.value,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Last name
                  </span>
                  <input
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        last_name: e.target.value,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                    required
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Email
                  </span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm((current) => ({
                          ...current,
                          email: e.target.value,
                        }))
                      }
                      placeholder={
                        form.role === SCHOOL_ADMINISTRATOR_INVITE_ROLE
                          ? "admin.office@school.com"
                          : "staff@school.com"
                      }
                      className="w-full rounded-workspace-md border border-workspace-border bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Role
                  </span>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        role: e.target.value as StaffInviteRoleValue,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Phone{" "}
                    <span className="font-normal text-workspace-muted">
                      (optional)
                    </span>
                  </span>
                  <input
                    value={form.phone}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department{" "}
                    <span className="font-normal text-workspace-muted">
                      (optional)
                    </span>
                  </span>
                  <input
                    value={form.department}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        department: e.target.value,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Position{" "}
                    <span className="font-normal text-workspace-muted">
                      (optional)
                    </span>
                  </span>
                  <input
                    value={form.position}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        position: e.target.value,
                      }))
                    }
                    className="w-full rounded-workspace-md border border-workspace-border bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-workspace-xs outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-workspace-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Create staff account
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setForm(EMPTY_FORM);
                  }}
                  className="rounded-workspace-md border border-workspace-border bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-workspace-xs transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 active:scale-[0.98]"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* ─── Pending invitations table ───────────────────────────── */}
          <div className="border-t border-workspace-border pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900">
                Pending invitations
              </h3>
              <button
                type="button"
                onClick={() => void loadInvitations()}
                className="rounded-workspace-md px-3 py-1.5 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700 active:scale-[0.98]"
              >
                Refresh
              </button>
            </div>

            {loadingList ? (
              <div className="flex items-center gap-3 rounded-workspace-lg border border-dashed border-workspace-border px-5 py-8 text-sm text-workspace-muted">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Loading invitations…
              </div>
            ) : invitations.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-workspace-lg border border-dashed border-workspace-border px-5 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <p className="max-w-sm text-sm text-workspace-muted">
                  No staff accounts yet. Use{" "}
                  <span className="font-semibold text-slate-600">
                    Invite School Administrator
                  </span>{" "}
                  or{" "}
                  <span className="font-semibold text-slate-600">
                    Invite other staff
                  </span>{" "}
                  to create accounts for your office team.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-workspace-lg border border-workspace-border shadow-workspace-xs">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-workspace-border bg-slate-50/80">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Role
                      </th>
                      <th className="hidden px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:table-cell">
                        Sent
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-workspace-border">
                    {invitations.map((row) => {
                      const name =
                        [row.first_name, row.last_name]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || row.email;
                      return (
                        <tr
                          key={row.id}
                          className="bg-white transition-colors hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {name}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.email}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                              {getStaffInviteRoleLabel(row.role)}
                            </span>
                          </td>
                          <td className="hidden whitespace-nowrap px-4 py-3 text-slate-500 sm:table-cell">
                            {row.created_at
                              ? new Date(row.created_at).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "\u2014"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              disabled={revokingId === row.id}
                              onClick={() => void revokeInvitation(row.id)}
                              className="rounded-workspace-md px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                            >
                              {revokingId === row.id ? "Revoking…" : "Revoke"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
