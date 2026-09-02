"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, RefreshCw, Trash2, Loader2, EyeOff, Eye, Check, X } from "lucide-react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  name: string | null;
  school: string | null;
  page: string | null;
  approved: boolean;
  hidden: boolean;
  created_at: string;
};

type Filter = "pending" | "approved" | "hidden" | "all";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={`h-3.5 w-3.5 ${
            value <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

export default function SuperAdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const body = await adminApiJson<{ data?: Review[] }>("/api/super-admin/reviews");
      setReviews(Array.isArray(body.data) ? body.data : []);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = useCallback(
    async (id: string, updates: { approved?: boolean; hidden?: boolean }) => {
      setBusyId(id);
      try {
        await adminApiJson("/api/super-admin/reviews", {
          method: "PATCH",
          body: JSON.stringify({ id, ...updates }),
        });
        setReviews((prev) =>
          prev.map((review) => (review.id === id ? { ...review, ...updates } : review)),
        );
        toast.success(
          updates.hidden === true
            ? "Hidden from public site"
            : updates.hidden === false
              ? "Visible again"
              : updates.approved
                ? "Published to landing page"
                : "Unpublished",
        );
      } catch {
        toast.error("Update failed");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this rating permanently?")) return;
      setBusyId(id);
      try {
        await adminApiJson(`/api/super-admin/reviews?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setReviews((prev) => prev.filter((review) => review.id !== id));
        toast.success("Rating deleted");
      } catch {
        toast.error("Delete failed");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const filtered = reviews.filter((review) => {
    if (filter === "pending") return !review.approved && !review.hidden;
    if (filter === "approved") return review.approved && !review.hidden;
    if (filter === "hidden") return review.hidden;
    return true;
  });

  const pendingCount = reviews.filter((r) => !r.approved && !r.hidden).length;

  const filters: { key: Filter; label: string }[] = [
    { key: "pending", label: `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` },
    { key: "approved", label: "Published" },
    { key: "hidden", label: "Hidden" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Site reviews</h1>
          <p className="mt-1 text-sm text-slate-500">
            Approve comments to publish them on the landing page. Hidden ratings
            are excluded from the public average.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setFilter(entry.key)}
            className={`min-h-[40px] rounded-full px-4 text-sm font-semibold transition ${
              filter === entry.key
                ? "bg-sky-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-700"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">
            {filter === "pending" ? "No reviews waiting for approval" : "Nothing here"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            New comments from the landing page arrive instantly and also trigger an email.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review) => (
            <div
              key={review.id}
              className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${
                review.hidden ? "border-slate-200 opacity-60" : review.approved ? "border-emerald-200" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={review.rating} />
                    <span className="text-sm font-semibold text-slate-900">
                      {review.name || "Anonymous"}
                    </span>
                    {review.school && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {review.school}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(review.created_at).toLocaleString("en-GB")}
                    </span>
                    {review.approved && !review.hidden && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        Published
                      </span>
                    )}
                    {review.hidden && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                        Hidden
                      </span>
                    )}
                  </div>
                  {review.comment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-slate-400">No comment (rating only)</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {review.comment && (
                    <button
                      onClick={() => void mutate(review.id, { approved: !review.approved })}
                      disabled={busyId === review.id}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition disabled:opacity-50 ${
                        review.approved
                          ? "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-700"
                      }`}
                    >
                      {review.approved ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                      {review.approved ? "Unpublish" : "Publish"}
                    </button>
                  )}
                  <button
                    onClick={() => void mutate(review.id, { hidden: !review.hidden })}
                    disabled={busyId === review.id}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    {review.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    {review.hidden ? "Unhide" : "Hide"}
                  </button>
                  <button
                    onClick={() => void remove(review.id)}
                    disabled={busyId === review.id}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  >
                    {busyId === review.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
