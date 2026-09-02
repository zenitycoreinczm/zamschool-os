"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

type PublicReview = {
  rating: number;
  comment: string;
  name: string | null;
  school: string | null;
  createdAt: string;
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          aria-hidden="true"
          className={`h-4 w-4 ${
            value <= rating ? "fill-amber-400 text-amber-400" : "fill-transparent text-slate-300"
          }`}
        />
      ))}
    </span>
  );
}

function initials(name: string | null): string {
  if (!name) return "ZS";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "ZS";
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/**
 * Public social-proof section: aggregate rating + approved reviews.
 *
 * Renders approved reviews and injects schema.org structured data
 * (SoftwareApplication + aggregateRating + Review) once loaded — Google
 * and Bing both process JS-injected JSON-LD for rich results.
 */
export default function PublicReviews() {
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [reviews, setReviews] = useState<PublicReview[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const [summaryRes, reviewsRes] = await Promise.all([
          fetch("/api/public/rating", { signal: controller.signal }),
          fetch("/api/public/rating/reviews", { signal: controller.signal }),
        ]);

        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          if (typeof summary.count === "number" && summary.count > 0) {
            setAverage(Number(summary.average) || 0);
            setCount(Number(summary.count) || 0);
          }
        }
        if (reviewsRes.ok) {
          const body = await reviewsRes.json();
          if (Array.isArray(body.reviews)) {
            setReviews(body.reviews.slice(0, 9));
          }
        }
      } catch {
        // Offline / aborted: section simply stays hidden.
      }
    })();

    return () => controller.abort();
  }, []);

  // Structured data for search-engine rich results (stars in Google).
  useEffect(() => {
    if (average === null || count === 0) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ZamSchool OS",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, Android",
      url: "https://www.zamschoolos.site",
      description:
        "School operating system for Zambian schools - attendance, ECZ results, parent communication, and fee management. Works offline.",
      offers: { "@type": "Offer", price: "0", priceCurrency: "ZMW" },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: String(Math.round(average * 10) / 10),
        bestRating: "5",
        worstRating: "1",
        ratingCount: String(count),
      },
      review: reviews.slice(0, 5).map((review) => ({
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(review.rating),
          bestRating: "5",
          worstRating: "1",
        },
        author: { "@type": "Person", name: review.name || "ZamSchool user" },
        datePublished: review.createdAt,
        reviewBody: review.comment,
      })),
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = "zamschool-reviews-jsonld";
    script.text = JSON.stringify(jsonLd);

    // Replace any previous injection (React strict-mode double effects).
    document.getElementById("zamschool-reviews-jsonld")?.remove();
    document.head.appendChild(script);

    return () => {
      document.getElementById("zamschool-reviews-jsonld")?.remove();
    };
  }, [average, count, reviews]);

  const hasContent = average !== null && count > 0;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          What schools say about ZamSchool OS
        </span>
        <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
          Trusted by Zambian schools
        </h2>

        {hasContent && (
          <div className="mt-4 flex flex-col items-center justify-center gap-1.5">
            <Stars rating={Math.round(average ?? 0)} />
            <p className="text-sm font-semibold text-slate-700">
              {Math.round((average ?? 0) * 10) / 10} out of 5
              <span className="ml-1.5 font-normal text-slate-500">
                · {count} {count === 1 ? "rating" : "ratings"} from schools across Zambia
              </span>
            </p>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review, index) => (
            <figure
              key={`${review.createdAt}-${index}`}
              className="landing-card flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <Stars rating={review.rating} />
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">
                &ldquo;{review.comment}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700"
                >
                  {initials(review.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {review.name || "Verified user"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {[review.school, formatDate(review.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {hasContent && reviews.length === 0 && (
        <p className="mt-6 text-center text-sm text-slate-500">
          Ratings are in — published reviews appear here after our team approves them.
        </p>
      )}
    </div>
  );
}
