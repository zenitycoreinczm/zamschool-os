"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

const STORAGE_PREFIX = "zamschool.messages.hint.";

export function MessageFirstVisitHint({
  role,
  dailyLimit = 5,
}: {
  role: "parent" | "student" | "teacher" | "admin";
  dailyLimit?: number;
}) {
  const storageKey = `${STORAGE_PREFIX}${role}`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Hydrating visibility from localStorage (an external system)
    try {
      if (localStorage.getItem(storageKey) !== "1") setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <section
      className="relative rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3"
      role="note"
    >
      <div className="flex gap-3 pr-8">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200/90">
          <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
        </span>
        <p className="min-w-0 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">Tip: </span>
          Up to {dailyLimit} school messages per day - homework help, a contact number, or meeting
          on campus. Reading is always unlimited.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss tip"
        className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-700"
      >
        <X className="h-4 w-4" />
      </button>
    </section>
  );
}