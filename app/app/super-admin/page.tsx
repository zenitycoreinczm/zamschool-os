"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AccessCode = {
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_email: string | null;
  max_uses?: number;
  use_count?: number;
  province?: string | null;
  district?: string | null;
  school_type?: string | null;
  ownership_type?: string | null;
  approval_status?: string | null;
  notes?: string | null;
};

type Stats = { total: number; active: number; used: number; expired: number };

type GenerateOpts = {
  expiresInHours: number;
  maxUses: number;
  province: string;
  district: string;
  schoolType: string;
  ownershipType: string;
  notes: string;
};

type FilterTab = "active" | "used" | "expired" | "all";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeRemainingParts(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  const secs = Math.floor((diff % 60_000) / 1_000);
  return { hours, mins, secs, total: diff };
}

function formatCountdown(
  parts: { hours: number; mins: number; secs: number } | null,
) {
  if (!parts) return "Expired";
  if (parts.hours > 0) return `${parts.hours}h ${parts.mins}m ${parts.secs}s`;
  if (parts.mins > 0) return `${parts.mins}m ${parts.secs}s`;
  return `${parts.secs}s`;
}

function codeStatus(code: AccessCode): "active" | "used" | "expired" {
  if (code.used_at) return "used";
  if (new Date(code.expires_at) <= new Date()) return "expired";
  return "active";
}

function statusStyles(status: "active" | "used" | "expired") {
  if (status === "used") {
    return {
      card: "border-slate-200 bg-slate-50/80",
      pill: "bg-slate-200 text-slate-600",
      label: "Used",
    };
  }
  if (status === "expired") {
    return {
      card: "border-amber-200/80 bg-amber-50/40",
      pill: "bg-amber-100 text-amber-800",
      label: "Expired",
    };
  }
  return {
    card: "border-slate-200 bg-white",
    pill: "bg-emerald-100 text-emerald-800",
    label: "Active",
  };
}

/* ------------------------------------------------------------------ */
/*  Live Countdown Hook                                                */
/* ------------------------------------------------------------------ */

function useCountdown(expiresAt: string) {
  const [parts, setParts] = useState(() => timeRemainingParts(expiresAt));

  useEffect(() => {
    const tick = () => setParts(timeRemainingParts(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return parts;
}

/* ------------------------------------------------------------------ */
/*  Code Card                                                          */
/* ------------------------------------------------------------------ */

function CodeCard({
  code,
  onDelete,
  deleting,
}: {
  code: AccessCode;
  onDelete: (code: string) => void;
  deleting: boolean;
}) {
  const status = codeStatus(code);
  const styles = statusStyles(status);
  const isActive = status === "active";
  const countdown = useCountdown(code.expires_at);

  const copy = () => {
    void navigator.clipboard.writeText(code.code);
    toast.success("Code copied");
  };

  const metaBits = [
    code.province,
    code.district,
    code.school_type,
    code.ownership_type,
  ].filter(Boolean) as string[];

  return (
    <article className={`rounded-2xl border p-4 ${styles.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl font-bold tracking-[0.18em] text-slate-900 sm:text-2xl">
              {isActive ? code.code : "••••••"}
            </span>
            {isActive ? (
              <button
                type="button"
                onClick={copy}
                title="Copy code"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
            ) : null}
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles.pill}`}
            >
              {styles.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {isActive && countdown ? (
              <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                <Clock className="h-3 w-3" />
                Expires in {formatCountdown(countdown)}
              </span>
            ) : null}
            {status === "used" && code.used_by_email ? (
              <span className="truncate">Used by {code.used_by_email}</span>
            ) : null}
            {code.max_uses && code.max_uses > 1 ? (
              <span>
                {code.use_count ?? 0}/{code.max_uses} uses
              </span>
            ) : null}
            <span>Created {new Date(code.created_at).toLocaleString()}</span>
          </div>

          {metaBits.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500">{metaBits.join(" · ")}</p>
          ) : null}
          {code.notes ? (
            <p className="mt-1 text-xs text-slate-400">{code.notes}</p>
          ) : null}
        </div>

        {isActive ? (
          <button
            type="button"
            onClick={() => onDelete(code.code)}
            disabled={deleting}
            title="Delete unused code"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Generate Code Form                                                 */
/* ------------------------------------------------------------------ */

function GenerateForm({
  onGenerate,
  loading,
}: {
  onGenerate: (opts: GenerateOpts) => void;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hours, setHours] = useState(3);
  const [maxUses, setMaxUses] = useState(1);
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [ownershipType, setOwnershipType] = useState("");
  const [notes, setNotes] = useState("");

  const submit = () => {
    onGenerate({
      expiresInHours: hours,
      maxUses,
      province: province.trim(),
      district: district.trim(),
      schoolType: schoolType.trim(),
      ownershipType: ownershipType.trim(),
      notes: notes.trim(),
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Generate code
        </button>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
        >
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {expanded ? "Hide options" : "More options"}
        </button>
        {!expanded ? (
          <span className="text-xs text-slate-400">
            {hours}h expiry · {maxUses} use{maxUses > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/60 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Expires in (hours)
              </span>
              <input
                type="number"
                min={1}
                max={720}
                value={hours}
                onChange={(e) =>
                  setHours(
                    Math.max(1, Math.min(720, Number(e.target.value) || 1)),
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Max uses
              </span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(e) =>
                  setMaxUses(
                    Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Province
              </span>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                District
              </span>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                School type
              </span>
              <input
                type="text"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
                placeholder="e.g. Secondary"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Ownership
              </span>
              <input
                type="text"
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value)}
                placeholder="e.g. GRZ, Mission"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">
                Notes
              </span>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal note (who requested the code, school name…)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function SuperAdminPage() {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    used: 0,
    expired: 0,
  });
  const mountedRef = useRef(true);

  const loadCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await adminApiJson("/api/super-admin/access-codes");
      const list: AccessCode[] = json.data || [];
      if (!mountedRef.current) return;
      setCodes(list);

      const now = new Date();
      const active = list.filter(
        (c) => !c.used_at && new Date(c.expires_at) > now,
      ).length;
      const used = list.filter((c) => Boolean(c.used_at)).length;
      const expired = list.filter(
        (c) => !c.used_at && new Date(c.expires_at) <= now,
      ).length;
      setStats({ total: list.length, active, used, expired });
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load codes";
      setError(msg);
      toast.error(msg);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadCodes();
    return () => {
      mountedRef.current = false;
    };
  }, [loadCodes]);

  const createCode = async (opts: GenerateOpts) => {
    setCreating(true);
    try {
      const json = await adminApiJson("/api/super-admin/access-codes", {
        method: "POST",
        body: JSON.stringify({
          expiresInHours: opts.expiresInHours,
          maxUses: opts.maxUses,
          province: opts.province || null,
          district: opts.district || null,
          schoolType: opts.schoolType || null,
          ownershipType: opts.ownershipType || null,
          notes: opts.notes || null,
        }),
      });
      const newCode = (json as { data?: { code?: string } })?.data?.code;
      toast.success(
        newCode ? `Access code generated: ${newCode}` : "Access code generated",
      );
      void loadCodes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setCreating(false);
    }
  };

  const deleteCode = async (code: string) => {
    if (!confirm(`Delete unused code ${code}? This cannot be undone.`)) return;
    setDeletingCode(code);
    try {
      await adminApiJson(`/api/super-admin/access-codes?code=${code}`, {
        method: "DELETE",
      });
      toast.success("Code deleted");
      void loadCodes();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete code");
    } finally {
      setDeletingCode(null);
    }
  };

  const filteredCodes = useMemo(() => {
    if (filter === "all") return codes;
    return codes.filter((c) => codeStatus(c) === filter);
  }, [codes, filter]);

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: stats.active },
    { key: "used", label: "Used", count: stats.used },
    { key: "expired", label: "Expired", count: stats.expired },
    { key: "all", label: "All", count: stats.total },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Platform
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Super Admin
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-500">
            Issue and manage school registration access codes. Each code lets one
            school register on ZamSchool OS.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCodes()}
          disabled={loading}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh access codes"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats — text only, no decorative icons */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Used", value: stats.used },
          { label: "Expired", value: stats.expired },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-2xl font-bold tabular-nums text-slate-900">
              {stat.value}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
        <p className="text-sm font-semibold text-slate-800">How codes work</p>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600">
          <li>
            Each code is a random 6-digit number. Default validity is{" "}
            <strong>3 hours</strong> (customizable).
          </li>
          <li>
            By default a code can only be used <strong>once</strong> — one school
            registration.
          </li>
          <li>
            Optionally tag province, district, school type, and notes so you know
            who each code was for.
          </li>
          <li>Unused, unexpired codes can be deleted at any time.</li>
        </ul>
      </div>

      <GenerateForm onGenerate={(opts) => void createCode(opts)} loading={creating} />

      {error && !loading ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800">
              Failed to load access codes
            </p>
            <p className="mt-0.5 text-xs text-red-600">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadCodes()}
            className="text-xs font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Filter tabs */}
      <div>
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                filter === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-10 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading codes…</span>
          </div>
        ) : filteredCodes.length === 0 && !error ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
            <p className="text-sm font-medium text-slate-600">
              {filter === "active"
                ? "No active codes"
                : filter === "used"
                  ? "No used codes yet"
                  : filter === "expired"
                    ? "No expired codes"
                    : "No codes yet"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {filter === "active"
                ? "Generate a code to share with a school administrator."
                : "Codes will appear here as they are issued and used."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredCodes.map((code) => (
              <CodeCard
                key={code.code}
                code={code}
                onDelete={(c) => void deleteCode(c)}
                deleting={deletingCode === code.code}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
