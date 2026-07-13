import { Loader2, Plus, X } from "lucide-react";
import {
  ClassSetupNotice,
  Field,
  FormNoticeBanner,
  InlineClassCreatorCard,
  InlineSubjectCreatorCard,
  SelectField,
  SelectOptionField,
} from "./form-fields";
import { DateOnlyPicker } from "@/components/forms/DateTimePicker";
import { buildSelectedSubjectSummary, createTeacherAssignmentDraft } from "./helpers";
import { primaryButton, secondaryButton } from "@/lib/workspace/design";
import { UsersModalShell } from "./UsersModalShell";
import type {
  ClassOption,
  FormNotice,
  SubjectOption,
  TabKey,
  TeacherInlineClassSection,
  TeacherInlineSubjectSection,
  UserForm,
} from "./types";

type UserFormModalProps = {
  activeTab: TabKey;
  isEditing: boolean;
  form: UserForm;
  formNotice: FormNotice | null;
  saving: boolean;
  classOptions: ClassOption[];
  subjectOptions: SubjectOption[];
  /** School department names for teacher employment select. */
  departmentNames?: string[];
  classNameById: Record<string, string>;
  subjectNameById: Record<string, string>;
  hydratingTeacherAssignments: boolean;
  selectedSpecializationSubjectId: string;
  selectedSupervisedClassId: string;
  openCreateSubjectInlineSection: TeacherInlineSubjectSection;
  openCreateClassInlineSection: TeacherInlineClassSection;
  creatingSubjectInline: boolean;
  creatingClassInline: boolean;
  subjectInlineDraft: { name: string; code: string };
  classInlineDraft: { name: string; gradeLevel: string; capacity: string };
  onFormChange: (updater: (prev: UserForm) => UserForm) => void;
  onSelectedSpecializationSubjectIdChange: (value: string) => void;
  onSelectedSupervisedClassIdChange: (value: string) => void;
  onOpenCreateSubjectInlineSectionChange: (
    value:
      | TeacherInlineSubjectSection
      | ((current: TeacherInlineSubjectSection) => TeacherInlineSubjectSection),
  ) => void;
  onOpenCreateClassInlineSectionChange: (
    value:
      | TeacherInlineClassSection
      | ((current: TeacherInlineClassSection) => TeacherInlineClassSection),
  ) => void;
  onSubjectInlineDraftChange: (value: {
    name: string;
    code: string;
  }) => void;
  onClassInlineDraftChange: (value: {
    name: string;
    gradeLevel: string;
    capacity: string;
  }) => void;
  onCreateSubjectInline: () => void;
  onCreateClassInline: () => void;
  onSave: () => void;
  onClose: () => void;
};

export function UserFormModal({
  activeTab,
  isEditing,
  form,
  formNotice,
  saving,
  classOptions,
  subjectOptions,
  departmentNames = [],
  classNameById,
  subjectNameById,
  hydratingTeacherAssignments,
  selectedSpecializationSubjectId,
  selectedSupervisedClassId,
  openCreateSubjectInlineSection,
  openCreateClassInlineSection,
  creatingSubjectInline,
  creatingClassInline,
  subjectInlineDraft,
  classInlineDraft,
  onFormChange,
  onSelectedSpecializationSubjectIdChange,
  onSelectedSupervisedClassIdChange,
  onOpenCreateSubjectInlineSectionChange,
  onOpenCreateClassInlineSectionChange,
  onSubjectInlineDraftChange,
  onClassInlineDraftChange,
  onCreateSubjectInline,
  onCreateClassInline,
  onSave,
  onClose,
}: UserFormModalProps) {
  const roleLabel =
    activeTab === "students"
      ? "Student"
      : activeTab === "teachers"
        ? "Teacher"
        : "Parent";

  return (
    <UsersModalShell
      size="5xl"
      scrollableOverlay
      title={`${isEditing ? "Edit" : "Create"} ${roleLabel}`}
      description={
        activeTab === "teachers"
          ? "Set up the teacher profile, specializations, teaching assignments, and class teacher responsibilities in one guided flow."
          : "Complete the user profile details and save the account."
      }
      onClose={onClose}
      bodyClassName="space-y-4"
      footer={
        <>
          <button type="button" onClick={onClose} className={secondaryButton()}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={primaryButton()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
            {isEditing
              ? "Save changes"
              : `Create ${activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent"}`}
          </button>
        </>
      }
    >
            {formNotice ? <FormNoticeBanner notice={formNotice} /> : null}
            {activeTab === "students" && classOptions.length === 0 ? (
              <ClassSetupNotice />
            ) : null}
            {activeTab === "teachers" && classOptions.length === 0 ? (
              <ClassSetupNotice />
            ) : null}
            <div className="grid md:grid-cols-2 gap-3">
              <Field
                label="First name"
                value={form.first_name}
                onChange={(v) =>
                  onFormChange((p) => ({ ...p, first_name: v }))
                }
                required
              />
              <Field
                label="Last name"
                value={form.last_name}
                onChange={(v) => onFormChange((p) => ({ ...p, last_name: v }))}
                required
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => onFormChange((p) => ({ ...p, email: v }))}
                required
              />
              <Field
                label="Phone (Zambia)"
                value={form.phone}
                onChange={(v) => onFormChange((p) => ({ ...p, phone: v }))}
                placeholder="0977123456 or +260977123456"
                inputMode="tel"
                hint="Optional. Airtel, MTN, or Zamtel mobile numbers."
              />
              <SelectField
                label="Gender"
                value={form.gender}
                onChange={(v) => onFormChange((p) => ({ ...p, gender: v }))}
                options={["", "male", "female"]}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(v) => onFormChange((p) => ({ ...p, status: v }))}
                options={["ACTIVE", "INACTIVE", "TRANSFERRED", "WITHDRAWN"]}
              />

              {activeTab === "students" ? (
                <>
                  <Field
                    label="Class number"
                    value={form.admission_number}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, admission_number: v }))
                    }
                    required
                    inputMode="numeric"
                    hint="Register number in class (e.g. 45). Used for roll call and results."
                  />
                  <SelectOptionField
                    label="Class"
                    value={form.class_id}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, class_id: v }))
                    }
                    options={classOptions}
                    placeholder="Select class (required)"
                    required
                  />
                  <DateOnlyPicker
                    label="Enrollment date"
                    value={form.enrollment_date}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, enrollment_date: v }))
                    }
                    accent="slate"
                    placeholder="When did they enroll?"
                  />
                </>
              ) : null}

              {activeTab === "teachers" ? (
                <>
                  <Field
                    label="Employee number"
                    value={form.employee_id}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, employee_id: v }))
                    }
                    required
                  />
                  {departmentNames.length > 0 ? (
                    <SelectField
                      label="Department"
                      value={form.department}
                      onChange={(v) =>
                        onFormChange((p) => ({ ...p, department: v }))
                      }
                      options={[
                        "",
                        ...departmentNames,
                        // Preserve legacy free-text values not in structure yet.
                        ...(form.department &&
                        !departmentNames.includes(form.department)
                          ? [form.department]
                          : []),
                      ]}
                    />
                  ) : (
                    <Field
                      label="Department"
                      value={form.department}
                      onChange={(v) =>
                        onFormChange((p) => ({ ...p, department: v }))
                      }
                      hint="Create departments under Structure so staff can pick from a list."
                    />
                  )}
                  <DateOnlyPicker
                    label="Hire date"
                    value={form.hire_date}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, hire_date: v }))
                    }
                    accent="slate"
                    placeholder="When were they hired?"
                  />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Specialization summary
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {buildSelectedSubjectSummary(
                        form.specialization_subject_ids,
                        subjectNameById,
                      ) || "No subjects selected yet"}
                    </p>
                  </div>
                </>
              ) : null}

              {activeTab === "parents" ? (
                <>
                  <Field
                    label="Relation type"
                    value={form.relation_type}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, relation_type: v }))
                    }
                  />
                  <Field
                    label="Occupation"
                    value={form.occupation}
                    onChange={(v) =>
                      onFormChange((p) => ({ ...p, occupation: v }))
                    }
                  />
                </>
              ) : null}
            </div>

            {activeTab === "teachers" ? (
              <TeacherAssignmentSection
                form={form}
                classOptions={classOptions}
                subjectOptions={subjectOptions}
                classNameById={classNameById}
                subjectNameById={subjectNameById}
                hydratingTeacherAssignments={hydratingTeacherAssignments}
                selectedSpecializationSubjectId={
                  selectedSpecializationSubjectId
                }
                selectedSupervisedClassId={selectedSupervisedClassId}
                openCreateSubjectInlineSection={openCreateSubjectInlineSection}
                openCreateClassInlineSection={openCreateClassInlineSection}
                creatingSubjectInline={creatingSubjectInline}
                creatingClassInline={creatingClassInline}
                subjectInlineDraft={subjectInlineDraft}
                classInlineDraft={classInlineDraft}
                onFormChange={onFormChange}
                onSelectedSpecializationSubjectIdChange={
                  onSelectedSpecializationSubjectIdChange
                }
                onSelectedSupervisedClassIdChange={
                  onSelectedSupervisedClassIdChange
                }
                onOpenCreateSubjectInlineSectionChange={
                  onOpenCreateSubjectInlineSectionChange
                }
                onOpenCreateClassInlineSectionChange={
                  onOpenCreateClassInlineSectionChange
                }
                onSubjectInlineDraftChange={onSubjectInlineDraftChange}
                onClassInlineDraftChange={onClassInlineDraftChange}
                onCreateSubjectInline={onCreateSubjectInline}
                onCreateClassInline={onCreateClassInline}
              />
            ) : null}
    </UsersModalShell>
  );
}

function TeacherAssignmentSection({
  form,
  classOptions,
  subjectOptions,
  classNameById,
  subjectNameById,
  hydratingTeacherAssignments,
  selectedSpecializationSubjectId,
  selectedSupervisedClassId,
  openCreateSubjectInlineSection,
  openCreateClassInlineSection,
  creatingSubjectInline,
  creatingClassInline,
  subjectInlineDraft,
  classInlineDraft,
  onFormChange,
  onSelectedSpecializationSubjectIdChange,
  onSelectedSupervisedClassIdChange,
  onOpenCreateSubjectInlineSectionChange,
  onOpenCreateClassInlineSectionChange,
  onSubjectInlineDraftChange,
  onClassInlineDraftChange,
  onCreateSubjectInline,
  onCreateClassInline,
}: {
  form: UserForm;
  classOptions: ClassOption[];
  subjectOptions: SubjectOption[];
  classNameById: Record<string, string>;
  subjectNameById: Record<string, string>;
  hydratingTeacherAssignments: boolean;
  selectedSpecializationSubjectId: string;
  selectedSupervisedClassId: string;
  openCreateSubjectInlineSection: TeacherInlineSubjectSection;
  openCreateClassInlineSection: TeacherInlineClassSection;
  creatingSubjectInline: boolean;
  creatingClassInline: boolean;
  subjectInlineDraft: { name: string; code: string };
  classInlineDraft: { name: string; gradeLevel: string; capacity: string };
  onFormChange: (updater: (prev: UserForm) => UserForm) => void;
  onSelectedSpecializationSubjectIdChange: (value: string) => void;
  onSelectedSupervisedClassIdChange: (value: string) => void;
  onOpenCreateSubjectInlineSectionChange: (
    value:
      | TeacherInlineSubjectSection
      | ((current: TeacherInlineSubjectSection) => TeacherInlineSubjectSection),
  ) => void;
  onOpenCreateClassInlineSectionChange: (
    value:
      | TeacherInlineClassSection
      | ((current: TeacherInlineClassSection) => TeacherInlineClassSection),
  ) => void;
  onSubjectInlineDraftChange: (value: {
    name: string;
    code: string;
  }) => void;
  onClassInlineDraftChange: (value: {
    name: string;
    gradeLevel: string;
    capacity: string;
  }) => void;
  onCreateSubjectInline: () => void;
  onCreateClassInline: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          Teaching Assignment
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Link this teacher to subject specializations, teaching classes, and
          class teacher responsibilities.
        </p>
      </div>

      {hydratingTeacherAssignments ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 flex items-center justify-center gap-3 text-sm text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
          Loading teacher assignments...
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Subject specializations
                </p>
                <p className="text-xs text-slate-500">
                  Choose the subjects this teacher can handle, or add a missing
                  subject without leaving the form.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenCreateSubjectInlineSectionChange((current) =>
                    current === "specializations" ? null : "specializations",
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add subject
              </button>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <SelectOptionField
                  label="Choose subject"
                  value={selectedSpecializationSubjectId}
                  onChange={onSelectedSpecializationSubjectIdChange}
                  options={subjectOptions}
                  placeholder="Select subject"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedSpecializationSubjectId) return;
                  onFormChange((current) => ({
                    ...current,
                    specialization_subject_ids:
                      current.specialization_subject_ids.includes(
                        selectedSpecializationSubjectId,
                      )
                        ? current.specialization_subject_ids
                        : [
                            ...current.specialization_subject_ids,
                            selectedSpecializationSubjectId,
                          ],
                  }));
                  onSelectedSpecializationSubjectIdChange("");
                }}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add to teacher
              </button>
            </div>
            {openCreateSubjectInlineSection === "specializations" ? (
              <InlineSubjectCreatorCard
                draft={subjectInlineDraft}
                loading={creatingSubjectInline}
                onChange={onSubjectInlineDraftChange}
                onCancel={() => onOpenCreateSubjectInlineSectionChange(null)}
                onSubmit={onCreateSubjectInline}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {form.specialization_subject_ids.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No subject specializations selected yet.
                </p>
              ) : (
                form.specialization_subject_ids.map((subjectId) => (
                  <button
                    key={subjectId}
                    type="button"
                    onClick={() =>
                      onFormChange((current) => ({
                        ...current,
                        specialization_subject_ids:
                          current.specialization_subject_ids.filter(
                            (value) => value !== subjectId,
                          ),
                      }))
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700"
                  >
                    {subjectNameById[subjectId] || "Subject"}
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Teaching assignments
                </p>
                <p className="text-xs text-slate-500">
                  Map the exact classes and subjects this teacher teaches. Each
                  row should answer one clear question: which subject does this
                  teacher handle in this class?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onOpenCreateClassInlineSectionChange((current) =>
                      current === "assignments" ? null : "assignments",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add class
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onOpenCreateSubjectInlineSectionChange((current) =>
                      current === "assignments" ? null : "assignments",
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add subject
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onFormChange((current) => ({
                      ...current,
                      teaching_assignments: [
                        ...current.teaching_assignments,
                        createTeacherAssignmentDraft(),
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add teaching assignment
                </button>
              </div>
            </div>
            {openCreateSubjectInlineSection === "assignments" ? (
              <InlineSubjectCreatorCard
                draft={subjectInlineDraft}
                loading={creatingSubjectInline}
                onChange={onSubjectInlineDraftChange}
                onCancel={() => onOpenCreateSubjectInlineSectionChange(null)}
                onSubmit={onCreateSubjectInline}
              />
            ) : null}
            {openCreateClassInlineSection === "assignments" ? (
              <InlineClassCreatorCard
                draft={classInlineDraft}
                loading={creatingClassInline}
                onChange={onClassInlineDraftChange}
                onCancel={() => onOpenCreateClassInlineSectionChange(null)}
                onSubmit={onCreateClassInline}
              />
            ) : null}

            {form.teaching_assignments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                No teaching assignments yet. Add the classes and subjects this
                teacher will handle.
              </div>
            ) : (
              <div className="space-y-3">
                {form.teaching_assignments.map((assignment, index) => (
                  <div
                    key={assignment.id}
                    className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                  >
                    <SelectOptionField
                      label={`Class ${index + 1}`}
                      value={assignment.classId}
                      onChange={(value) =>
                        onFormChange((current) => ({
                          ...current,
                          teaching_assignments:
                            current.teaching_assignments.map((item) =>
                              item.id === assignment.id
                                ? { ...item, classId: value }
                                : item,
                            ),
                        }))
                      }
                      options={classOptions}
                      placeholder="Select class"
                    />
                    <SelectOptionField
                      label="Subject"
                      value={assignment.subjectId}
                      onChange={(value) =>
                        onFormChange((current) => ({
                          ...current,
                          teaching_assignments:
                            current.teaching_assignments.map((item) =>
                              item.id === assignment.id
                                ? { ...item, subjectId: value }
                                : item,
                            ),
                        }))
                      }
                      options={subjectOptions}
                      placeholder="Select subject"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onFormChange((current) => ({
                          ...current,
                          teaching_assignments:
                            current.teaching_assignments.filter(
                              (item) => item.id !== assignment.id,
                            ),
                        }))
                      }
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  Class teacher responsibilities
                </p>
                <p className="text-xs text-slate-500">
                  Choose the classes this teacher supervises as class teacher,
                  or create a missing class inline.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenCreateClassInlineSectionChange((current) =>
                    current === "supervised" ? null : "supervised",
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Add class
              </button>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <SelectOptionField
                  label="Choose class"
                  value={selectedSupervisedClassId}
                  onChange={onSelectedSupervisedClassIdChange}
                  options={classOptions}
                  placeholder="Select class"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!selectedSupervisedClassId) return;
                  onFormChange((current) => ({
                    ...current,
                    supervised_class_ids: current.supervised_class_ids.includes(
                      selectedSupervisedClassId,
                    )
                      ? current.supervised_class_ids
                      : [
                          ...current.supervised_class_ids,
                          selectedSupervisedClassId,
                        ],
                  }));
                  onSelectedSupervisedClassIdChange("");
                }}
                className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Add class teacher role
              </button>
            </div>
            {openCreateClassInlineSection === "supervised" ? (
              <InlineClassCreatorCard
                draft={classInlineDraft}
                loading={creatingClassInline}
                onChange={onClassInlineDraftChange}
                onCancel={() => onOpenCreateClassInlineSectionChange(null)}
                onSubmit={onCreateClassInline}
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              {form.supervised_class_ids.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No class teacher responsibilities selected yet.
                </p>
              ) : (
                form.supervised_class_ids.map((classId) => (
                  <button
                    key={classId}
                    type="button"
                    onClick={() =>
                      onFormChange((current) => ({
                        ...current,
                        supervised_class_ids:
                          current.supervised_class_ids.filter(
                            (value) => value !== classId,
                          ),
                      }))
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                  >
                    {classNameById[classId] || "Class"}
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
