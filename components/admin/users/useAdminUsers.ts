"use client";

import { useCallback, useState } from "react";
import type { NewCredentials } from "@/components/admin/users/types";
import { useUsersDirectory } from "@/components/admin/users/useUsersDirectory";
import { useUserForm } from "@/components/admin/users/useUserForm";
import { useUserDetail } from "@/components/admin/users/useUserDetail";
import { useParentLinks } from "@/components/admin/users/useParentLinks";

/**
 * Composer for the admin Users console. Owns credentials modal state and
 * wires directory / form / detail / parent-link hooks. Public shape matches
 * what `AdminUsersPage` already consumes.
 */
export function useAdminUsers() {
  const [newCredentials, setNewCredentials] = useState<NewCredentials | null>(
    null,
  );

  const directory = useUsersDirectory();

  const onCredentials = useCallback((credentials: NewCredentials) => {
    setNewCredentials(credentials);
  }, []);

  const form = useUserForm({
    schoolId: directory.schoolId,
    activeTab: directory.activeTab,
    students: directory.students,
    teachers: directory.teachers,
    parentsProfiles: directory.parentsProfiles,
    parentsMetaMap: directory.parentsMetaMap,
    classOptions: directory.classOptions,
    subjectOptions: directory.subjectOptions,
    subjectNameById: directory.subjectNameById,
    onRefresh: directory.fetchAll,
    onAddClassOption: directory.addClassOption,
    onAddSubjectOption: directory.addSubjectOption,
    onCredentials,
    canCreateUsers: directory.canCreateUsers,
  });

  const detail = useUserDetail({
    schoolId: directory.schoolId,
    activeTab: directory.activeTab,
    onRefresh: directory.fetchAll,
    onCredentials,
  });

  const parentLinks = useParentLinks({
    students: directory.students,
  });

  return {
    // access
    isRecoveryConsole: directory.isRecoveryConsole,
    canInviteStaff: directory.canInviteStaff,
    isHrConsole: directory.isHrConsole,
    canCreateUsers: directory.canCreateUsers,
    canDeleteUsers: directory.canDeleteUsers,
    loading: directory.loading,
    // directory
    activeTab: directory.activeTab,
    setActiveTab: directory.setActiveTab,
    search: directory.search,
    setSearch: directory.setSearch,
    setPageByTab: directory.setPageByTab,
    pageByTab: directory.pageByTab,
    accountOverview: directory.accountOverview,
    currentRows: directory.currentRows,
    paginatedRows: directory.paginatedRows,
    totalPages: directory.totalPages,
    classNameById: directory.classNameById,
    subjectNameById: directory.subjectNameById,
    parentsMetaMap: directory.parentsMetaMap,
    parentsTable: directory.parentsTable,
    parentStudentsTable: directory.parentStudentsTable,
    deleting: directory.deleting,
    // staff invites
    staffInvitesExpanded: directory.staffInvitesExpanded,
    setStaffInvitesExpanded: directory.setStaffInvitesExpanded,
    // form modal
    openForm: form.openForm,
    setOpenForm: form.setOpenForm,
    editTarget: form.editTarget,
    form: form.form,
    setForm: form.setForm,
    formNotice: form.formNotice,
    saving: form.saving,
    classOptions: directory.classOptions,
    subjectOptions: directory.subjectOptions,
    hydratingTeacherAssignments: form.hydratingTeacherAssignments,
    selectedSpecializationSubjectId: form.selectedSpecializationSubjectId,
    setSelectedSpecializationSubjectId: form.setSelectedSpecializationSubjectId,
    selectedSupervisedClassId: form.selectedSupervisedClassId,
    setSelectedSupervisedClassId: form.setSelectedSupervisedClassId,
    openCreateSubjectInlineSection: form.openCreateSubjectInlineSection,
    setOpenCreateSubjectInlineSection: form.setOpenCreateSubjectInlineSection,
    openCreateClassInlineSection: form.openCreateClassInlineSection,
    setOpenCreateClassInlineSection: form.setOpenCreateClassInlineSection,
    creatingSubjectInline: form.creatingSubjectInline,
    creatingClassInline: form.creatingClassInline,
    subjectInlineDraft: form.subjectInlineDraft,
    setSubjectInlineDraft: form.setSubjectInlineDraft,
    classInlineDraft: form.classInlineDraft,
    setClassInlineDraft: form.setClassInlineDraft,
    openCreate: form.openCreate,
    createSubjectInline: form.createSubjectInline,
    createClassInline: form.createClassInline,
    handleSave: form.handleSave,
    departmentNames: directory.departmentNames,
    // detail modal
    detailTarget: detail.detailTarget,
    detailData: detail.detailData,
    detailRole: detail.detailRole,
    detailLoading: detail.detailLoading,
    detailError: detail.detailError,
    canResetTemporaryPassword: detail.canResetTemporaryPassword,
    canDisableMfa: detail.canDisableMfa,
    canManageUserMfa: detail.canManageUserMfa,
    mfaStatus: detail.mfaStatus,
    mfaLoading: detail.mfaLoading,
    resettingPassword: detail.resettingPassword,
    disablingMfa: detail.disablingMfa,
    openDetail: detail.openDetail,
    openEdit: form.openEdit,
    handleDelete: directory.handleDelete,
    quickToggleStatus: directory.quickToggleStatus,
    resetTemporaryPassword: detail.resetTemporaryPassword,
    disableUserMfa: detail.disableUserMfa,
    closeDetail: detail.closeDetail,
    // parent link modal
    openLinkModal: parentLinks.openLinkModal,
    setOpenLinkModal: parentLinks.setOpenLinkModal,
    selectedParent: parentLinks.selectedParent,
    linkCandidates: parentLinks.linkCandidates,
    linkedStudentIds: parentLinks.linkedStudentIds,
    linkSearch: parentLinks.linkSearch,
    setLinkSearch: parentLinks.setLinkSearch,
    linking: parentLinks.linking,
    openParentLinkManager: parentLinks.openParentLinkManager,
    toggleLinkStudent: parentLinks.toggleLinkStudent,
    // credentials modal
    newCredentials,
    setNewCredentials,
  };
}
