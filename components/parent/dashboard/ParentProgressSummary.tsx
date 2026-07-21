"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Users } from "lucide-react";

import { Surface } from "@/components/workspace/Surface";

export function ParentProgressSummary() {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/ai/parent-summary");
        const body = await res.json();
        if (!cancelled && body.success && body.data?.summaries) {
          setSummaries(body.data.summaries);
        } else if (!cancelled) {
          setSummaries({});
        }
      } catch {
        if (!cancelled) setSummaries({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  const entries = Object.entries(summaries);
  if (entries.length === 0) return null;

  return (
    <Surface variant="elevated" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Progress Summary</h2>
          <p className="text-xs text-slate-500">AI-powered overview of your children</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {entries.map(([name, summary]) => (
          <div key={name} className="rounded-xl bg-amber-50/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" />
              <p className="text-sm font-semibold text-slate-900">{name}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {summary}
            </p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
