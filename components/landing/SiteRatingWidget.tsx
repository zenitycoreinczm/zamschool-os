"use client";

import { useState, useEffect, useCallback } from "react";
import { Star } from "lucide-react";
import { fetchWithCsrf } from "@/lib/csrf-client";

export default function SiteRatingWidget() {
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "rate-limited">("idle");
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/rating", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.count > 0) {
          setAverage(data.average);
          setCount(data.count);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selectedRating === 0 || status === "submitting") return;

    setStatus("submitting");
    try {
      const res = await fetchWithCsrf("/api/public/rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: selectedRating,
          comment: comment.trim() || undefined,
          name: name.trim() || undefined,
          school: school.trim() || undefined,
          page: "/",
        }),
      });

      if (res.ok) {
        setStatus("success");
        setComment("");
        setName("");
        setSchool("");
        setSelectedRating(0);
      } else if (res.status === 429) {
        setStatus("rate-limited");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [selectedRating, comment, name, school, status]);

  const handleKeyDown = (e: React.KeyboardEvent, value: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setSelectedRating(value);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(5, value + 1);
      setSelectedRating(next);
      const el = document.getElementById(`star-${next}`);
      el?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const prev = Math.max(1, value - 1);
      setSelectedRating(prev);
      const el = document.getElementById(`star-${prev}`);
      el?.focus();
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-sm font-semibold text-emerald-800">Thank you for your feedback!</p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-3 text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
        >
          Submit another rating
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="text-center">
        <h3 className="text-base font-bold text-slate-900">Rate ZamSchool OS</h3>
        {average !== null && count > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            Average: {average}/5 ({count} {count === 1 ? "rating" : "ratings"})
          </p>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Select a rating from 1 to 5 stars"
        className="mt-4 flex items-center justify-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const isActive = value <= (hoverRating || selectedRating);
          return (
            <button
              key={value}
              id={`star-${value}`}
              role="radio"
              aria-checked={selectedRating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              tabIndex={value === 1 ? 0 : -1}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setSelectedRating(value)}
              onKeyDown={(e) => handleKeyDown(e, value)}
              className="rounded-lg p-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              <Star
                className={`h-7 w-7 transition ${
                  isActive
                    ? "fill-amber-400 text-amber-400"
                    : "fill-transparent text-slate-300"
                }`}
              />
            </button>
          );
        })}
      </div>

      {selectedRating > 0 && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="rating-name" className="block text-xs font-semibold text-slate-700">
                Your name (optional)
              </label>
              <input
                id="rating-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                maxLength={80}
                placeholder="e.g. Mr. Banda"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <div>
              <label htmlFor="rating-school" className="block text-xs font-semibold text-slate-700">
                School (optional)
              </label>
              <input
                id="rating-school"
                type="text"
                value={school}
                onChange={(e) => setSchool(e.target.value.slice(0, 120))}
                maxLength={120}
                placeholder="e.g. Munali Secondary"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rating-comment" className="block text-xs font-semibold text-slate-700">
              Comment (optional)
            </label>
            <textarea
              id="rating-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={2}
              placeholder="Tell us what you think..."
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                Comments are published after review by our team.
              </span>
              <span className="text-[10px] text-slate-400">{comment.length}/500</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={selectedRating === 0 || status === "submitting"}
        className="mt-3 inline-flex w-full min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 active:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "submitting" ? "Submitting..." : "Submit Rating"}
      </button>

      {status === "rate-limited" && (
        <p className="mt-2 text-center text-xs text-rose-600">
          You already submitted a rating recently. Please try again later.
        </p>
      )}
      {status === "error" && (
        <p className="mt-2 text-center text-xs text-rose-600">
          Something went wrong. Please try again later.
        </p>
      )}
    </div>
  );
}