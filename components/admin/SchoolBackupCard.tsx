"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Download,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { adminApiJson } from "@/lib/admin-browser-api";

type BackupStatus = {
  redisConfigured?: boolean;
  periodId?: string;
  periodLabel?: string;
  retentionDays?: number;
  periodDays?: number;
  available?: boolean;
  downloadPath?: string;
  note?: string;
  snapshot?: {
    schoolName?: string;
    generatedAt?: string;
    expiresAt?: string;
    periodLabel?: string;
    metrics?: {
      student?: number;
      teacher?: number;
      parent?: number;
      classCount?: number;
    };
  } | null;
};

/**
 * Biweekly aggregate PDF backup for Head Teacher + ICT Admin.
 * Snapshot auto-expires after 7 days in Upstash (storage saver).
 */
export function SchoolBackupCard({
  title = "School backup summary",
}: {
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState<BackupStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminApiJson<{ data?: BackupStatus }>(
        "/api/admin/school-backup",
      );
      setStatus(body?.data ?? null);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load backup status",
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function regenerate() {
    setGenerating(true);
    try {
      await adminApiJson("/api/admin/school-backup", { method: "POST" });
      toast.success("Backup summary refreshed for this period");
      await refresh();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate backup",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await fetch("/api/admin/school-backup/download", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] || "zamschool-backup.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded — keep a copy offline");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  const snap = status?.snapshot;
  const m = snap?.metrics;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Every 2 weeks, download an aggregate PDF for offline backup (Head
            Teacher & ICT). The server copy auto-deletes after{" "}
            {status?.retentionDays ?? 7} days to save storage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void regenerate()}
            disabled={generating || loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh summary
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading || loading || !status?.redisConfigured}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking backup period…
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Meta
            label="Period"
            value={status?.periodLabel || status?.periodId || "—"}
          />
          <Meta
            label="Generated"
            value={
              snap?.generatedAt
                ? new Date(snap.generatedAt).toLocaleString()
                : "Not yet"
            }
          />
          <Meta
            label="Auto-deletes"
            value={
              snap?.expiresAt
                ? new Date(snap.expiresAt).toLocaleString()
                : "—"
            }
          />
          <Meta
            label="Storage"
            value={
              status?.redisConfigured
                ? "Upstash (7-day TTL)"
                : "Redis not configured"
            }
          />
        </div>
      )}

      {m ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill icon={FileText} text={`${m.student ?? 0} students`} />
          <Pill icon={FileText} text={`${m.teacher ?? 0} teachers`} />
          <Pill icon={FileText} text={`${m.parent ?? 0} parents`} />
          <Pill icon={FileText} text={`${m.classCount ?? 0} classes`} />
        </div>
      ) : null}

      {status?.note ? (
        <p className="mt-3 text-xs text-slate-500">{status.note}</p>
      ) : null}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Pill({
  icon: Icon,
  text,
}: {
  icon: typeof FileText;
  text: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
      <Icon className="h-3.5 w-3.5 text-sky-600" />
      {text}
    </span>
  );
}
