import { Search } from "lucide-react";
import { getDisplayName } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import { UsersModalShell } from "./UsersModalShell";
import type { DirectoryUser, ParentLinkTarget } from "./types";

type ParentLinkModalProps = {
  parent: DirectoryUser;
  candidates: ParentLinkTarget[];
  linkedStudentIds: string[];
  linkSearch: string;
  linking: boolean;
  onSearchChange: (value: string) => void;
  onToggleLink: (studentId: string, shouldLink: boolean) => void;
  onClose: () => void;
};

export function ParentLinkModal({
  parent,
  candidates,
  linkedStudentIds,
  linkSearch,
  linking,
  onSearchChange,
  onToggleLink,
  onClose,
}: ParentLinkModalProps) {
  const linkedCount = linkedStudentIds.length;

  return (
    <UsersModalShell
      size="3xl"
      title={`Link students to ${getDisplayName(parent)}`}
      description={`${linkedCount} student${linkedCount === 1 ? "" : "s"} currently linked. Toggle link to attach or remove.`}
      onClose={onClose}
      bodyClassName="space-y-4"
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          value={linkSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search students by name or number"
          aria-label="Search students"
          className="w-full rounded-workspace-xl border border-workspace-border bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-sky-200"
        />
      </div>

      <div
        className="max-h-[380px] divide-y divide-workspace-border overflow-auto rounded-workspace-xl border border-workspace-border"
        role="list"
        aria-label="Student link candidates"
      >
        {candidates.length === 0 ? (
          <div
            className="px-4 py-10 text-center text-sm text-workspace-muted"
            role="status"
          >
            {linkSearch.trim()
              ? "No students match your search."
              : "No students available to link."}
          </div>
        ) : (
          candidates.map((student) => {
            const linked = linkedStudentIds.includes(student.id);
            return (
              <div
                key={student.id}
                role="listitem"
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {student.name}
                  </p>
                  <p className="text-xs text-workspace-muted">
                    {student.admission || "No student number"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleLink(student.id, !linked)}
                  disabled={linking}
                  aria-pressed={linked}
                  className={cn(
                    "shrink-0 rounded-workspace-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-60",
                    linked
                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
                  )}
                >
                  {linked ? "Unlink" : "Link"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </UsersModalShell>
  );
}
