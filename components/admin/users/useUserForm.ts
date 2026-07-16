"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { adminApiJson } from "@/lib/admin-browser-api";
import {
  EMPTY_FORM,
  type ClassOption,
  type DirectoryUser,
  type FormNotice,
  type NewCredentials,
  type ParentMeta,
  type SubjectOption,
  type TabKey,
  type TeacherInlineClassSection,
  type TeacherInlineSubjectSection,
  type UserDetailData,
  type UserForm,
} from "@/components/admin/users/types";
import {
  applyTeacherDetailToForm,
  buildSelectedSubjectSummary,
  dedupeTeacherAssignments,
  emptyTeacherCreateForm,
  formFromDirectoryRow,
  tabToManagedRole,
  toClassOptions,
  validateUserForm,
} from "@/components/admin/users/helpers";
import { normalizeOptionalZambianPhone } from "@/lib/zambia-localization";

type UseUserFormArgs = {
  schoolId: string | null;
  activeTab: TabKey;
  students: DirectoryUser[];
  teachers: DirectoryUser[];
  parentsProfiles: DirectoryUser[];
  parentsMetaMap: Record<string, ParentMeta>;
  classOptions: ClassOption[];
  subjectOptions: SubjectOption[];
  subjectNameById: Record<string, string>;
  onRefresh: () => Promise<void>;
  onAddClassOption: (option: ClassOption) => void;
  onAddSubjectOption: (option: SubjectOption) => void;
  onCredentials: (credentials: NewCredentials) => void;
  /** When false, create is blocked (HR / recovery consoles). */
  canCreateUsers?: boolean;
};

export function useUserForm({
  schoolId,
  activeTab,
  students,
  teachers,
  parentsProfiles,
  parentsMetaMap,
  classOptions,
  subjectOptions,
  subjectNameById,
  onRefresh,
  onAddClassOption,
  onAddSubjectOption,
  onCredentials,
  canCreateUsers = true,
}: UseUserFormArgs) {
  const [openForm, setOpenForm] = useState(false);
  const [editTarget, setEditTarget] = useState<DirectoryUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [hydratingTeacherAssignments, setHydratingTeacherAssignments] =
    useState(false);
  const [formNotice, setFormNotice] = useState<FormNotice | null>(null);
  const [selectedSpecializationSubjectId, setSelectedSpecializationSubjectId] =
    useState("");
  const [selectedSupervisedClassId, setSelectedSupervisedClassId] =
    useState("");
  const [openCreateSubjectInlineSection, setOpenCreateSubjectInlineSection] =
    useState<TeacherInlineSubjectSection>(null);
  const [openCreateClassInlineSection, setOpenCreateClassInlineSection] =
    useState<TeacherInlineClassSection>(null);
  const [creatingSubjectInline, setCreatingSubjectInline] = useState(false);
  const [creatingClassInline, setCreatingClassInline] = useState(false);
  const [subjectInlineDraft, setSubjectInlineDraft] = useState({
    name: "",
    code: "",
  });
  const [classInlineDraft, setClassInlineDraft] = useState({
    name: "",
    gradeLevel: "",
    capacity: "30",
  });

  const resetTeacherInlineSetupState = useCallback(() => {
    setFormNotice(null);
    setSelectedSpecializationSubjectId("");
    setSelectedSupervisedClassId("");
    setOpenCreateSubjectInlineSection(null);
    setOpenCreateClassInlineSection(null);
    setCreatingSubjectInline(false);
    setCreatingClassInline(false);
    setSubjectInlineDraft({ name: "", code: "" });
    setClassInlineDraft({ name: "", gradeLevel: "", capacity: "30" });
  }, []);

  const openCreate = useCallback(() => {
    if (!canCreateUsers) {
      toast.error(
        "This role cannot create accounts. HR maintains existing staff records; the Head Teacher invites office staff.",
      );
      return;
    }
    setEditTarget(null);
    setHydratingTeacherAssignments(false);
    resetTeacherInlineSetupState();
    setForm(activeTab === "teachers" ? emptyTeacherCreateForm() : EMPTY_FORM);
    setOpenForm(true);
  }, [activeTab, resetTeacherInlineSetupState, canCreateUsers]);

  const openEdit = useCallback(
    async (row: DirectoryUser) => {
      setEditTarget(row);
      resetTeacherInlineSetupState();
      const parentMeta = parentsMetaMap[row.id] || {};
      setForm(formFromDirectoryRow(row, classOptions, parentMeta));
      setOpenForm(true);

      if (activeTab !== "teachers") return;

      setHydratingTeacherAssignments(true);
      try {
        const body = await adminApiJson<{ data?: UserDetailData }>(
          `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=teacher`,
        );
        const teacherDetail = (body?.data || {}) as UserDetailData;
        setForm((current) => applyTeacherDetailToForm(current, teacherDetail));
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load teacher assignments";
        toast.error(message);
      } finally {
        setHydratingTeacherAssignments(false);
      }
    },
    [activeTab, classOptions, parentsMetaMap, resetTeacherInlineSetupState],
  );

  const createSubjectInline = useCallback(async () => {
    const name = subjectInlineDraft.name.trim();
    const code = subjectInlineDraft.code.trim();
    if (!name) {
      setFormNotice({
        tone: "error",
        message: "Subject name is required before you can create it.",
      });
      toast.error("Subject name is required");
      return;
    }

    const existingOption = subjectOptions.find(
      (option) => option.label.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existingOption) {
      setForm((current) => ({
        ...current,
        specialization_subject_ids: current.specialization_subject_ids.includes(
          existingOption.id,
        )
          ? current.specialization_subject_ids
          : [...current.specialization_subject_ids, existingOption.id],
      }));
      setSelectedSpecializationSubjectId(existingOption.id);
      setSubjectInlineDraft({ name: "", code: "" });
      setOpenCreateSubjectInlineSection(null);
      setFormNotice({
        tone: "info",
        message: `${existingOption.label} already exists, so it has been selected for this teacher.`,
      });
      toast.success("Existing subject selected");
      return;
    }

    setCreatingSubjectInline(true);
    const loadingToast = toast.loading("Creating subject...");
    try {
      const response = await adminApiJson<{
        data?: { id?: string; name?: string };
      }>("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({ name, code: code || undefined }),
      });
      const created = response?.data;
      const option =
        created &&
        typeof created.id === "string" &&
        typeof created.name === "string"
          ? { id: created.id, label: created.name.trim() }
          : null;

      if (!option) {
        throw new Error(
          "Subject was created but no subject details were returned",
        );
      }

      onAddSubjectOption(option);
      setForm((current) => ({
        ...current,
        specialization_subject_ids: current.specialization_subject_ids.includes(
          option.id,
        )
          ? current.specialization_subject_ids
          : [...current.specialization_subject_ids, option.id],
      }));
      setSelectedSpecializationSubjectId(option.id);
      setSubjectInlineDraft({ name: "", code: "" });
      setOpenCreateSubjectInlineSection(null);
      setFormNotice({
        tone: "info",
        message: `${option.label} was created and added to this teacher's subject specializations.`,
      });
      toast.success("Subject added", { id: loadingToast });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create subject";
      setFormNotice({ tone: "error", message });
      toast.error(message, { id: loadingToast });
    } finally {
      setCreatingSubjectInline(false);
    }
  }, [subjectInlineDraft, subjectOptions, onAddSubjectOption]);

  const createClassInline = useCallback(async () => {
    const name = classInlineDraft.name.trim();
    const gradeLevel = Number(classInlineDraft.gradeLevel);
    const capacity = Number(classInlineDraft.capacity || 30);

    if (!name) {
      setFormNotice({
        tone: "error",
        message: "Class name is required before you can create it.",
      });
      toast.error("Class name is required");
      return;
    }

    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 13) {
      setFormNotice({
        tone: "error",
        message: "Choose a valid grade level before creating the class.",
      });
      toast.error("Choose a valid grade level");
      return;
    }

    setCreatingClassInline(true);
    const loadingToast = toast.loading("Creating class...");
    try {
      const response = await adminApiJson<{ data?: unknown }>(
        "/api/admin/classes",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            gradeLevel,
            capacity: Number.isFinite(capacity) ? capacity : 30,
          }),
        },
      );
      const createdOptions = toClassOptions(
        response?.data ? [response.data] : [],
      );
      const option = createdOptions[0] || null;
      if (!option) {
        throw new Error("Class was created but no class details were returned");
      }

      onAddClassOption(option);
      setSelectedSupervisedClassId(option.id);
      setClassInlineDraft({ name: "", gradeLevel: "", capacity: "30" });
      setOpenCreateClassInlineSection(null);
      setFormNotice({
        tone: "info",
        message: `${option.label} was created and is now available for teaching assignments and class-teacher roles.`,
      });
      toast.success("Class added", { id: loadingToast });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create class";
      setFormNotice({ tone: "error", message });
      toast.error(message, { id: loadingToast });
    } finally {
      setCreatingClassInline(false);
    }
  }, [classInlineDraft, onAddClassOption]);

  const handleSave = useCallback(async () => {
    if (!schoolId) return;
    setFormNotice(null);

    const validation = validateUserForm({
      form,
      activeTab,
      classOptionsCount: classOptions.length,
      editTargetId: editTarget?.id,
      students,
      teachers,
      parents: parentsProfiles,
    });
    if (validation) {
      setFormNotice(validation);
      toast.error(validation.message);
      return;
    }

    const roleValue = tabToManagedRole(activeTab);
    const teacherSpecializationSummary =
      activeTab === "teachers"
        ? buildSelectedSubjectSummary(
            form.specialization_subject_ids,
            subjectNameById,
          )
        : null;
    const teacherAssignmentsPayload =
      activeTab === "teachers"
        ? dedupeTeacherAssignments(form.teaching_assignments)
        : [];

    if (!editTarget && !canCreateUsers) {
      toast.error(
        "This role cannot create accounts. Update existing staff records only.",
      );
      return;
    }

    setSaving(true);
    const t = toast.loading(
      editTarget ? "Updating user..." : "Creating user...",
    );
    let credentialsEmailSent = false;
    const normalizedPhone = normalizeOptionalZambianPhone(form.phone);

    try {
      if (editTarget) {
        await adminApiJson("/api/admin/users", {
          method: "PUT",
          body: JSON.stringify({
            profileId: editTarget.id,
            role: roleValue,
            firstName: form.first_name.trim(),
            lastName: form.last_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: normalizedPhone,
            gender: form.gender || null,
            status: form.status || "ACTIVE",
            admissionNumber: form.admission_number.trim() || null,
            classNumber: form.admission_number.trim() || null,
            classId: form.class_id || null,
            enrollmentDate: form.enrollment_date || null,
            employeeId: form.employee_id.trim() || null,
            department: form.department.trim() || null,
            specialization:
              teacherSpecializationSummary ||
              form.specialization.trim() ||
              null,
            hireDate: form.hire_date || null,
            relationType: form.relation_type || null,
            occupation: form.occupation.trim() || null,
            specializationSubjectIds: form.specialization_subject_ids,
            teachingAssignments: teacherAssignmentsPayload,
            supervisedClassIds: form.supervised_class_ids,
          }),
        });
      } else {
        const createBody = await adminApiJson<{
          temporaryPassword?: string;
          credentialsEmailSent?: boolean;
        }>("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            role: roleValue,
            firstName: form.first_name.trim(),
            lastName: form.last_name.trim(),
            email: form.email.trim().toLowerCase(),
            phone: normalizedPhone,
            profileExtras:
              activeTab === "students"
                ? {
                    admission_number: form.admission_number.trim(),
                    class_number: form.admission_number.trim(),
                    class_id: form.class_id || null,
                    enrollment_date: form.enrollment_date || null,
                    gender: form.gender || null,
                    status: form.status || "ACTIVE",
                  }
                : activeTab === "teachers"
                  ? {
                      employee_id: form.employee_id.trim(),
                      department: form.department.trim() || null,
                      specialization:
                        teacherSpecializationSummary ||
                        form.specialization.trim() ||
                        null,
                      hire_date: form.hire_date || null,
                      gender: form.gender || null,
                      status: form.status || "ACTIVE",
                    }
                  : {
                      gender: form.gender || null,
                      status: form.status || "ACTIVE",
                    },
            parentExtras:
              activeTab === "parents"
                ? {
                    relation_type: form.relation_type || null,
                    occupation: form.occupation.trim() || null,
                  }
                : undefined,
            specializationSubjectIds:
              activeTab === "teachers"
                ? form.specialization_subject_ids
                : undefined,
            teachingAssignments:
              activeTab === "teachers" ? teacherAssignmentsPayload : undefined,
            supervisedClassIds:
              activeTab === "teachers" ? form.supervised_class_ids : undefined,
          }),
        });

        credentialsEmailSent = Boolean(createBody.credentialsEmailSent);
        if (createBody?.temporaryPassword) {
          onCredentials({
            email: form.email.trim().toLowerCase(),
            password: String(createBody.temporaryPassword),
            emailSent: credentialsEmailSent,
          });
        }
      }

      await onRefresh();
      setOpenForm(false);
      setEditTarget(null);
      setForm(EMPTY_FORM);
      setFormNotice(null);
      toast.success(
        editTarget
          ? "User updated"
          : credentialsEmailSent
            ? "User created - sign-in details emailed"
            : "User created - copy the temporary password to share",
        { id: t },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to save user";
      setFormNotice({ tone: "error", message });
      toast.error(message, { id: t });
    } finally {
      setSaving(false);
    }
  }, [
    schoolId,
    form,
    activeTab,
    classOptions.length,
    editTarget,
    students,
    teachers,
    parentsProfiles,
    subjectNameById,
    onRefresh,
    onCredentials,
    canCreateUsers,
  ]);

  return {
    openForm,
    setOpenForm,
    editTarget,
    form,
    setForm,
    formNotice,
    saving,
    hydratingTeacherAssignments,
    selectedSpecializationSubjectId,
    setSelectedSpecializationSubjectId,
    selectedSupervisedClassId,
    setSelectedSupervisedClassId,
    openCreateSubjectInlineSection,
    setOpenCreateSubjectInlineSection,
    openCreateClassInlineSection,
    setOpenCreateClassInlineSection,
    creatingSubjectInline,
    creatingClassInline,
    subjectInlineDraft,
    setSubjectInlineDraft,
    classInlineDraft,
    setClassInlineDraft,
    openCreate,
    openEdit,
    createSubjectInline,
    createClassInline,
    handleSave,
  };
}
