"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

type ConsentChoice = "all" | "essential" | "selected";

interface ConsentPreferences {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
}

const STORAGE_KEY = "zamschool-cookie-consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return !(stored && JSON.parse(stored)?.preferences);
    } catch {
      // Corrupted consent storage: show the banner.
      return true;
    }
  });
  const [showSelected, setShowSelected] = useState(false);
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    essential: true,
    analytics: false,
    marketing: false,
  });

  const saveAndDismiss = useCallback((choice: ConsentChoice, prefs?: ConsentPreferences) => {
    const data = {
      choice,
      preferences: prefs ?? { essential: true, analytics: false, marketing: false },
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setVisible(false);
  }, []);

  const handleAcceptAll = () => {
    saveAndDismiss("all", { essential: true, analytics: true, marketing: true });
  };

  const handleRejectNonEssential = () => {
    saveAndDismiss("essential", { essential: true, analytics: false, marketing: false });
  };

  const handleAcceptSelected = () => {
    saveAndDismiss("selected", preferences);
  };

  const togglePreference = (key: "analytics" | "marketing") => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-4 shadow-workspace-overlay backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto max-w-7xl">
        {!showSelected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-relaxed text-slate-700">
                We use cookies to improve your experience. Read our{" "}
                <Link href="/cookies" className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-800">
                  Cookie Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="font-semibold text-sky-700 underline underline-offset-2 hover:text-sky-800">
                  Terms of Service
                </Link>
                .
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                onClick={handleAcceptAll}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 active:bg-sky-800"
              >
                Accept All
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              >
                Reject Non-Essential
              </button>
              <button
                onClick={() => setShowSelected(true)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              >
                Accept Selected
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-slate-900">Manage cookie preferences</p>
            <fieldset className="space-y-2">
              <legend className="sr-only">Cookie categories</legend>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-300" />
                <span>
                  <span className="font-semibold text-slate-700">Essential</span> — Required for site functionality
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-sky-300">
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={() => togglePreference("analytics")}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>
                  <span className="font-semibold text-slate-900">Analytics</span> — Help us understand usage patterns
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-sky-300">
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={() => togglePreference("marketing")}
                  className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>
                  <span className="font-semibold text-slate-900">Marketing</span> — Personalized content and ads
                </span>
              </label>
            </fieldset>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAcceptSelected}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-bold text-white transition hover:bg-sky-700 active:bg-sky-800"
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowSelected(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}