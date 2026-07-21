"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles, Lightbulb } from "lucide-react";

import { Surface } from "@/components/workspace/Surface";
import { cn } from "@/lib/utils";

export function StudentStudyTips() {
  const [tips, setTips] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/ai/student-tips");
        const body = await res.json();
        if (!cancelled && body.success && body.data?.tips) {
          setTips(body.data.tips);
        } else if (!cancelled) {
          setTips([]);
        }
      } catch {
        if (!cancelled) setTips([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return null;

  if (tips.length === 0) return null;

  return (
    <Surface variant="elevated" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Study Tips</h2>
          <p className="text-xs text-slate-500">AI-powered advice for you</p>
        </div>
      </div>
      <div className="space-y-2 p-4">
        {tips.map((tip, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-xl bg-amber-50/50 px-4 py-3"
          >
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm leading-relaxed text-slate-700">{tip}</p>
          </div>
        ))}
      </div>
    </Surface>
  );
}
