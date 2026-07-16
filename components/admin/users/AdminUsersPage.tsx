"use client";

import { Loader2, Plus, Search } from "lucide-react";
import { AccountsSetupGuide } from "@/components/admin/AccountsSetupGuide";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { StaffInvitePanel } from "@/components/admin/StaffInvitePanel";
import { UsersTabBar } from "@/components/admin/users/UsersTabBar";
import { UsersDirectoryTable } from "@/components/admin/users/UsersDirectoryTable";
import { UserFormModal } from "@/components/admin/users/UserFormModal";
import { UserDetailModal } from "@/components/admin/users/UserDetailModal";
import { ParentLinkModal } from "@/components/admin/users/ParentLinkModal";
import { NewCredentialsModal } from "@/components/admin/users/NewCredentialsModal";
import { useAdminUsers } from "@/components/admin/users/useAdminUsers";
import { primaryButton } from "@/lib/workspace/design";
import type { TabKey } from "@/components/admin/users/types";

export default function AdminUsersPage() {
  const u = useAdminUsers();

  if (u.loading) {
    return (
      <div
        className="flex items-center justify-center gap-3 rounded-workspace-2xl border border-workspace-border bg-white p-10 shadow-workspace-sm"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden />
        <span className="text-sm text-workspace-muted">Loading users…</span>
      </div>
    );
  }

  const addLabel =
    u.activeTab === "students"
      ? "student"
      : u.activeTab === "teachers"
        ? "teacher"
        : "parent";

  const visibleTabs: TabKey[] | undefined = u.isHrConsole
    ? ["teachers"]
    : undefined;

  const incompleteEmployment =
    typeof u.accountOverview.incompleteEmployment === "number"
      ? u.accountOverview.incompleteEmployment
      : 0;

  const heroStats = u.isHrConsole
    ? [
        {
          label: "Teachers",
          value: u.accountOverview.teachers,
          hint: `${u.accountOverview.activeTeachers} active`,
          tone: "slate" as const,
        },
        {
          label: "Records to complete",
          value: incompleteEmployment,
          hint:
            incompleteEmployment > 0
              ? "Missing employee #, department, or hire date"
              : "Employment fields look complete",
          tone: incompleteEmployment > 0 ? ("amber" as const) : ("slate" as const),
        },
      ]
    : [
        {
          label: "Students",
          value: u.accountOverview.students,
          hint: `${u.accountOverview.activeStudents} active`,
          tone: "sky" as const,
        },
        {
          label: "Teachers",
          value: u.accountOverview.teachers,
          hint: `${u.accountOverview.activeTeachers} active`,
          tone: "violet" as const,
        },
        {
          label: "Parents",
          value: u.accountOverview.parents,
          hint: `${u.accountOverview.activeParents} active`,
          tone: "amber" as const,
        },
        ...(u.canInviteStaff
          ? [
              {
                label: "Office staff",
                value: "Invites",
                hint: "Section below ↓",
                tone: "emerald" as const,
              },
            ]
          : []),
      ];

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow={
          u.isRecoveryConsole
            ? "User recovery"
            : u.isHrConsole
              ? "People desk"
              : "School directory"
        }
        title={
          u.isRecoveryConsole
            ? "User accounts"
            : u.isHrConsole
              ? "Staff directory"
              : "Users & accounts"
        }
        description={
          u.isRecoveryConsole
            ? "Search students, teachers, and parents to troubleshoot access. Open a profile and use Reset temporary password when someone is locked out or needs a fresh login."
            : u.canInviteStaff
              ? "Add students, parents, and teachers with the Add button and tabs below. Invite Deputy Head, Bursar, Registrar, and other office staff in the Staff invitations section - not through Add student/teacher/parent."
              : u.isHrConsole
                ? "View and update employment records for teachers already on the system. You do not create accounts or send invitations - the Head Teacher does that."
                : "Register students, parents, and teachers for your school. Use the Add button and tabs below to create accounts and assign classes."
        }
        accent={u.isHrConsole ? "slate" : "sky"}
        stats={heroStats}
        actions={
          <>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                value={u.search}
                onChange={(e) => {
                  u.setSearch(e.target.value);
                  u.setPageByTab((prev) => ({ ...prev, [u.activeTab]: 1 }));
                }}
                placeholder={
                  u.isHrConsole ? "Search staff" : "Search directory"
                }
                aria-label="Search directory"
                className="w-44 rounded-workspace-xl border border-white/20 bg-white/10 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-sky-300/50 sm:w-56"
              />
            </div>
            {u.canCreateUsers ? (
              <button
                type="button"
                onClick={u.openCreate}
                className={primaryButton(
                  "bg-brand hover:bg-brand-hover shadow-none",
                )}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add {addLabel}
              </button>
            ) : null}
          </>
        }
      />

      {u.canInviteStaff && (
        <AccountsSetupGuide
          onOpenStaffInvites={() => {
            u.setStaffInvitesExpanded(true);
            document
              .getElementById("staff-invitations")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {u.canInviteStaff && (
        <StaffInvitePanel
          expanded={u.staffInvitesExpanded}
          onExpandedChange={u.setStaffInvitesExpanded}
        />
      )}

      {u.isHrConsole ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">HR scope</p>
          <p className="mt-1">
            Edit teacher employment details, department, and status. Account
            creation and invitations are not part of HR - use{" "}
            <a
              href="/app/admin/departments"
              className="font-medium text-slate-800 underline-offset-2 hover:underline"
            >
              Departments
            </a>{" "}
            for structure, and leave invites to the Head Teacher. Prefer
            department names from school structure so headcounts stay accurate.
          </p>
        </div>
      ) : null}

      <UsersTabBar
        activeTab={u.activeTab}
        visibleTabs={visibleTabs}
        counts={{
          students: u.accountOverview.students,
          teachers: u.accountOverview.teachers,
          parents: u.accountOverview.parents,
        }}
        onChange={(tab) => {
          u.setActiveTab(tab);
          u.setSearch("");
        }}
      />

      <div
        role="tabpanel"
        id={`users-panel-${u.activeTab}`}
        aria-labelledby={`users-tab-${u.activeTab}`}
      >
        <UsersDirectoryTable
          activeTab={u.activeTab}
          rows={u.paginatedRows}
          totalCount={u.currentRows.length}
          page={u.pageByTab[u.activeTab] || 1}
          totalPages={u.totalPages}
          classNameById={u.classNameById}
          parentsMetaMap={u.parentsMetaMap}
          canLinkParents={
            !u.isHrConsole && Boolean(u.parentsTable && u.parentStudentsTable)
          }
          canCreateUsers={u.canCreateUsers}
          showEmploymentGaps={u.isHrConsole || u.activeTab === "teachers"}
          deletingId={u.deleting}
          hasSearch={Boolean(u.search.trim())}
          onAdd={u.canCreateUsers ? u.openCreate : undefined}
          onPrevPage={() =>
            u.setPageByTab((prev) => ({
              ...prev,
              [u.activeTab]: Math.max(1, (prev[u.activeTab] || 1) - 1),
            }))
          }
          onNextPage={() =>
            u.setPageByTab((prev) => ({
              ...prev,
              [u.activeTab]: Math.min(
                u.totalPages,
                (prev[u.activeTab] || 1) + 1,
              ),
            }))
          }
          onToggleStatus={(row) => void u.quickToggleStatus(row)}
          onLinkStudents={(row) => void u.openParentLinkManager(row)}
          onViewDetails={(row) => void u.openDetail(row)}
          onEdit={(row) => void u.openEdit(row)}
          onDelete={
            u.canDeleteUsers
              ? (row) => void u.handleDelete(row)
              : undefined
          }
        />
      </div>

      {u.openForm ? (
        <UserFormModal
          activeTab={u.activeTab}
          isEditing={Boolean(u.editTarget)}
          form={u.form}
          formNotice={u.formNotice}
          saving={u.saving}
          classOptions={u.classOptions}
          subjectOptions={u.subjectOptions}
          departmentNames={u.departmentNames}
          classNameById={u.classNameById}
          subjectNameById={u.subjectNameById}
          hydratingTeacherAssignments={u.hydratingTeacherAssignments}
          selectedSpecializationSubjectId={u.selectedSpecializationSubjectId}
          selectedSupervisedClassId={u.selectedSupervisedClassId}
          openCreateSubjectInlineSection={u.openCreateSubjectInlineSection}
          openCreateClassInlineSection={u.openCreateClassInlineSection}
          creatingSubjectInline={u.creatingSubjectInline}
          creatingClassInline={u.creatingClassInline}
          subjectInlineDraft={u.subjectInlineDraft}
          classInlineDraft={u.classInlineDraft}
          onFormChange={u.setForm}
          onSelectedSpecializationSubjectIdChange={
            u.setSelectedSpecializationSubjectId
          }
          onSelectedSupervisedClassIdChange={u.setSelectedSupervisedClassId}
          onOpenCreateSubjectInlineSectionChange={
            u.setOpenCreateSubjectInlineSection
          }
          onOpenCreateClassInlineSectionChange={
            u.setOpenCreateClassInlineSection
          }
          onSubjectInlineDraftChange={u.setSubjectInlineDraft}
          onClassInlineDraftChange={u.setClassInlineDraft}
          onCreateSubjectInline={() => void u.createSubjectInline()}
          onCreateClassInline={() => void u.createClassInline()}
          onSave={() => void u.handleSave()}
          onClose={() => u.setOpenForm(false)}
        />
      ) : null}

      {u.detailTarget ? (
        <UserDetailModal
          activeTab={u.activeTab}
          detailTarget={u.detailTarget}
          detailData={u.detailData}
          detailRole={u.detailRole}
          detailLoading={u.detailLoading}
          detailError={u.detailError}
          canResetTemporaryPassword={
            u.canResetTemporaryPassword && !u.isHrConsole
          }
          canDisableMfa={u.canDisableMfa && !u.isHrConsole}
          canManageUserMfa={u.canManageUserMfa && !u.isHrConsole}
          mfaStatus={u.mfaStatus}
          mfaLoading={u.mfaLoading}
          resettingPasswordId={u.resettingPassword}
          disablingMfaId={u.disablingMfa}
          onResetPassword={() => void u.resetTemporaryPassword(u.detailTarget)}
          onDisableMfa={() => void u.disableUserMfa(u.detailTarget)}
          onEdit={() => {
            if (u.detailTarget) void u.openEdit(u.detailTarget);
          }}
          onClose={u.closeDetail}
        />
      ) : null}

      {u.openLinkModal && u.selectedParent ? (
        <ParentLinkModal
          parent={u.selectedParent}
          candidates={u.linkCandidates}
          linkedStudentIds={u.linkedStudentIds}
          linkSearch={u.linkSearch}
          linking={u.linking}
          onSearchChange={u.setLinkSearch}
          onToggleLink={(studentId, shouldLink) =>
            void u.toggleLinkStudent(studentId, shouldLink)
          }
          onClose={() => u.setOpenLinkModal(false)}
        />
      ) : null}

      {u.newCredentials ? (
        <NewCredentialsModal
          credentials={u.newCredentials}
          onClose={() => u.setNewCredentials(null)}
        />
      ) : null}
    </div>
  );
}
