import { cn } from "@/lib/utils";

type FocusPillsProps = {
  items: string[];
  /** @deprecated Staff UI uses slate only; accent is ignored. */
  accent?: "sky" | "teal" | "indigo" | "slate";
};

export function FocusPills({ items }: FocusPillsProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Focus areas">
      {items.map((item) => (
        <span
          key={item}
          role="listitem"
          className={cn(
            "rounded-full border border-slate-200/90 bg-slate-50/90 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-workspace-xs backdrop-blur-sm",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}