import {
  Eye,
  GraduationCap,
  Loader2,
  Pencil,
  Trash2,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { getDisplayName } from "@/lib/profile-utils";
import { cn } from "@/lib/utils";
import { secondaryButton, surface } from "@/lib/workspace/design";
import type { DirectoryUser, ParentMeta, TabKey } from "./types";

type UsersDirectoryTableProps = {
  activeTab: TabKey;
  rows: DirectoryUser[];
  totalCount: number;
  page: number;
  totalPages: number;
  classNameById: Record<string, string>;
  parentsMetaMap: Record<string, ParentMeta>;
  canLinkParents: boolean;
  deletingId: string | null;
  hasSearch?: boolean;
  onAdd?: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onToggleStatus: (row: DirectoryUser) => void;
  onLinkStudents: (row: DirectoryUser) => void;
  onViewDetails: (row: DirectoryUser) => void;
  onEdit: (row: DirectoryUser) => void;
  onDelete?: (row: DirectoryUser) => void;
  /** When false, empty state does not prompt to create users (HR console). */
  canCreateUsers?: boolean;
  /** Show missing employment field chips on teacher rows (HR focus). */
  showEmploymentGaps?: boolean;
};

const tabMeta: Record<
  TabKey,
  { icon: typeof GraduationCap; singular: string; plural: string }
> = {
  students: { icon: GraduationCap, singular: "student", plural: "students" },
  teachers: { icon: Users, singular: "teacher", plural: "teachers" },
  parents: { icon: UsersRound, singular: "parent", plural: "parents" },
};

const thClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-workspace-muted";

const actionBtnClass =
  "inline-flex items-center gap-1 rounded-workspace-lg border border-workspace-border bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300";

const iconBtnClass =
  "grid h-8 w-8 place-items-center rounded-workspace-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300";

export function UsersDirectoryTable({
  activeTab,
  rows,
  totalCount,
  page,
  totalPages,
  classNameById,
  parentsMetaMap,
  canLinkParents,
  deletingId,
  hasSearch = false,
  onAdd,
  onPrevPage,
  onNextPage,
  onToggleStatus,
  onLinkStudents,
  onViewDetails,
  onEdit,
  onDelete,
  canCreateUsers = true,
  showEmploymentGaps = false,
}: UsersDirectoryTableProps) {
  const meta = tabMeta[activeTab];
  const colSpan =
    activeTab === "students" ||
    activeTab === "teachers" ||
    activeTab === "parents"
      ? 9
      : 7;
  const showCreateAction = Boolean(onAdd) && canCreateUsers && !hasSearch;

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={meta.icon}
        title={
          hasSearch
            ? `No ${meta.plural} match your search`
            : `No ${meta.plural} yet`
        }
        description={
          hasSearch
            ? "Try a different name, email, or ID — or clear the search to see everyone."
            : canCreateUsers
              ? `Add the first ${meta.singular} to start building your school directory.`
              : "No staff on the directory yet. The Head Teacher invites people; they appear here after they accept."
        }
        actionLabel={showCreateAction ? `Add ${meta.singular}` : undefined}
        onAction={showCreateAction ? onAdd : undefined}
      />
    );
  }

  return (
    <div className={cn(surface("default"), "overflow-hidden rounded-workspace-2xl")}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={`${meta.plural} directory`}>
          <thead className="bg-slate-50/90">
            <tr>
              <th scope="col" className={thClass}>
                Name
              </th>
              <th scope="col" className={thClass}>
                Email
              </th>
              <th scope="col" className={thClass}>
                Phone
              </th>
              {activeTab === "students" ? (
                <>
                  <th scope="col" className={thClass}>
                    Student No
                  </th>
                  <th scope="col" className={thClass}>
                    Class
                  </th>
                </>
              ) : null}
              {activeTab === "teachers" ? (
                <>
                  <th scope="col" className={thClass}>
                    Employee No
                  </th>
                  <th scope="col" className={thClass}>
                    Department
                  </th>
                </>
              ) : null}
              {activeTab === "parents" ? (
                <>
                  <th scope="col" className={thClass}>
                    Relation
                  </th>
                  <th scope="col" className={thClass}>
                    Occupation
                  </th>
                </>
              ) : null}
              <th scope="col" className={thClass}>
                Status
              </th>
              <th scope="col" className={cn(thClass, "text-right")}>
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-4 py-12 text-center text-workspace-muted"
                >
                  No {meta.plural} on this page.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const parentMeta = parentsMetaMap[row.id] || {};
                const name = getDisplayName(row);
                const isActive =
                  String(row.status || "ACTIVE").toUpperCase() === "ACTIVE";
                return (
                  <tr
                    key={row.id}
                    className="border-t border-workspace-border transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{name}</div>
                      {showEmploymentGaps && activeTab === "teachers" ? (
                        <EmploymentGapChips row={row} />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {row.phone || "—"}
                    </td>
                    {activeTab === "students" ? (
                      <>
                        <td className="px-4 py-3 text-slate-600">
                          {row.admission_number || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {(row.class_id
                            ? classNameById[row.class_id]
                            : undefined) ||
                            row.class_name ||
                            row.class ||
                            "—"}
                        </td>
                      </>
                    ) : null}
                    {activeTab === "teachers" ? (
                      <>
                        <td className="px-4 py-3 text-slate-600">
                          {row.employee_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {row.department || "—"}
                        </td>
                      </>
                    ) : null}
                    {activeTab === "parents" ? (
                      <>
                        <td className="px-4 py-3 text-slate-600">
                          {(typeof parentMeta.relation_type === "string" &&
                            parentMeta.relation_type) ||
                            "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {(typeof parentMeta.occupation === "string" &&
                            parentMeta.occupation) ||
                            row.occupation ||
                            "—"}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(row)}
                        aria-label={`Set ${name} to ${isActive ? "inactive" : "active"}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-workspace-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                          isActive
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200/80"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200/80",
                        )}
                      >
                        <UserCheck className="h-3.5 w-3.5" aria-hidden />
                        {String(row.status || "ACTIVE").toUpperCase()}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {activeTab === "parents" && canLinkParents ? (
                          <button
                            type="button"
                            onClick={() => onLinkStudents(row)}
                            className={actionBtnClass}
                            aria-label={`Link students to ${name}`}
                          >
                            Link
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onViewDetails(row)}
                          className={actionBtnClass}
                          aria-label={`View details for ${name}`}
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className={cn(
                            iconBtnClass,
                            "bg-slate-100 text-slate-600 hover:bg-slate-200",
                          )}
                          aria-label={`Edit ${name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {onDelete ? (
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            disabled={deletingId === row.id}
                            className={cn(
                              iconBtnClass,
                              "bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60",
                            )}
                            aria-label={`Delete ${name}`}
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-workspace-border px-4 py-3">
        <p className="text-xs text-workspace-muted">
          Showing{" "}
          <span className="ws-tabular font-medium text-slate-700">
            {rows.length}
          </span>{" "}
          of{" "}
          <span className="ws-tabular font-medium text-slate-700">
            {totalCount}
          </span>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={page <= 1}
            className={cn(secondaryButton(), "px-3 py-1.5 text-xs")}
          >
            Prev
          </button>
          <span className="ws-tabular text-xs text-slate-600" aria-live="polite">
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={page >= totalPages}
            className={cn(secondaryButton(), "px-3 py-1.5 text-xs")}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function EmploymentGapChips({ row }: { row: DirectoryUser }) {
  const gaps: string[] = [];
  if (!String(row.employee_id || "").trim()) gaps.push("No employee #");
  if (!String(row.department || "").trim()) gaps.push("No department");
  if (!String(row.hire_date || "").trim()) gaps.push("No hire date");
  if (gaps.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {gaps.map((gap) => (
        <span
          key={gap}
          className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 ring-1 ring-amber-200/80"
        >
          {gap}
        </span>
      ))}
    </div>
  );
}
