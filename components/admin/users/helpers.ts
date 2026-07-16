import { getDisplayName } from "@/lib/profile-utils";
import { zambianPhoneValidationError } from "@/lib/zambia-localization";
import type {
  ClassOption,
  DirectoryUser,
  FormNotice,
  GenericRow,
  ManagedAccountRole,
  ParentMeta,
  TabKey,
  TeacherAssignmentDraft,
  UserDetailData,
  UserForm,
} from "./types";
import { EMPTY_FORM } from "./types";

export function tabToManagedRole(tab: TabKey): ManagedAccountRole {
  if (tab === "students") return "student";
  if (tab === "teachers") return "teacher";
  return "parent";
}

export function isActiveStatus(status: unknown): boolean {
  return String(status || "ACTIVE").toUpperCase() === "ACTIVE";
}

export function countActiveUsers(rows: DirectoryUser[]): number {
  return rows.filter((row) => isActiveStatus(row.status)).length;
}

export function filterDirectoryRows(
  rows: DirectoryUser[],
  query: string,
  classNameById: Record<string, string>,
): DirectoryUser[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const classLabel = row.class_id ? classNameById[row.class_id] || "" : "";
    const haystack = [
      getDisplayName(row),
      row.email,
      row.phone,
      row.admission_number,
      row.class_number != null ? String(row.class_number) : "",
      classLabel,
      row.employee_id,
      row.department,
      row.specialization,
      row.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function formFromDirectoryRow(
  row: DirectoryUser,
  classOptions: ClassOption[],
  parentMeta: ParentMeta = {},
): UserForm {
  return {
    first_name: row.first_name || "",
    last_name: row.last_name || "",
    email: row.email || "",
    phone: row.phone || "",
    gender: row.gender || "",
    status: row.status || "ACTIVE",
    admission_number:
      row.admission_number ||
      (row.class_number != null ? String(row.class_number) : "") ||
      "",
    class_id:
      row.class_id ||
      findClassId(classOptions, row.class_name || row.class || ""),
    enrollment_date: row.enrollment_date || row.enrolled_at || "",
    employee_id: row.employee_id || "",
    department: row.department || "",
    specialization: row.specialization || "",
    hire_date: row.hire_date || row.hired_at || "",
    relation_type:
      (typeof parentMeta.relation_type === "string" && parentMeta.relation_type) ||
      "Mother",
    occupation:
      (typeof parentMeta.occupation === "string" && parentMeta.occupation) ||
      row.occupation ||
      "",
    specialization_subject_ids: [],
    teaching_assignments: [],
    supervised_class_ids: [],
  };
}

export function applyTeacherDetailToForm(
  current: UserForm,
  teacherDetail: UserDetailData,
): UserForm {
  return {
    ...current,
    specialization: String(
      teacherDetail.specialization || current.specialization || "",
    ),
    specialization_subject_ids: Array.isArray(
      teacherDetail.specializationSubjectIds,
    )
      ? teacherDetail.specializationSubjectIds.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [],
    teaching_assignments: Array.isArray(teacherDetail.teachingAssignments)
      ? teacherDetail.teachingAssignments.flatMap((assignment, index) => {
          const classId = String(assignment?.classId || "").trim();
          const subjectId = String(assignment?.subjectId || "").trim();
          if (!classId || !subjectId) return [];
          return [
            {
              id: buildTeacherAssignmentDraftId(index),
              classId,
              subjectId,
            },
          ];
        })
      : [],
    supervised_class_ids: Array.isArray(teacherDetail.supervisedClassIds)
      ? teacherDetail.supervisedClassIds.filter(
          (value): value is string =>
            typeof value === "string" && value.length > 0,
        )
      : [],
  };
}

export function validateUserForm(input: {
  form: UserForm;
  activeTab: TabKey;
  classOptionsCount: number;
  editTargetId?: string | null;
  students: DirectoryUser[];
  teachers: DirectoryUser[];
  parents: DirectoryUser[];
}): FormNotice | null {
  const { form, activeTab, classOptionsCount, editTargetId, students, teachers, parents } =
    input;

  if (
    !form.first_name.trim() ||
    !form.last_name.trim() ||
    !form.email.trim()
  ) {
    return {
      tone: "error",
      message:
        "First name, last name, and email are required before you can save this user.",
    };
  }

  const phoneError = zambianPhoneValidationError(form.phone);
  if (phoneError) {
    return { tone: "error", message: phoneError };
  }

  if (activeTab === "students" && !form.admission_number.trim()) {
    return {
      tone: "error",
      message:
        "Class number is required before you can create this student (e.g. 45 for roll call).",
    };
  }

  if (
    activeTab === "students" &&
    form.admission_number.trim() &&
    !/^\d{1,5}$/.test(form.admission_number.trim())
  ) {
    return {
      tone: "error",
      message: "Class number must be a positive whole number (e.g. 1–99999).",
    };
  }

  if (activeTab === "students" && !form.class_id.trim()) {
    return {
      tone: "error",
      message: classOptionsCount
        ? "Select a class for this student before saving."
        : "Create at least one class under Classes before adding students.",
    };
  }

  if (activeTab === "teachers" && !form.employee_id.trim()) {
    return {
      tone: "error",
      message: "Employee number is required before you can create this teacher.",
    };
  }

  if (
    activeTab === "teachers" &&
    form.teaching_assignments.some(
      (assignment) =>
        !String(assignment.classId || "").trim() ||
        !String(assignment.subjectId || "").trim(),
    )
  ) {
    return {
      tone: "error",
      message:
        "Every teaching assignment needs both a class and a subject before the teacher can be saved.",
    };
  }

  const teacherClassAssignments = dedupeTeacherAssignments(
    form.teaching_assignments,
  );
  if (
    activeTab === "teachers" &&
    teacherClassAssignments.length === 0 &&
    form.supervised_class_ids.length === 0
  ) {
    return {
      tone: "error",
      message:
        "Assign this teacher to at least one class - add a teaching row (class + subject) or a class teacher responsibility.",
    };
  }

  const normalizedEmail = form.email.trim().toLowerCase();
  const duplicateEmail = [...students, ...teachers, ...parents].some((row) => {
    if (row.id === editTargetId) return false;
    return normalizeComparableValue(row.email) === normalizedEmail;
  });
  if (duplicateEmail) {
    return {
      tone: "error",
      message:
        "This email address is already linked to another user. Use a different email before creating the account.",
    };
  }

  if (activeTab === "teachers") {
    const normalizedEmployeeId = normalizeComparableValue(form.employee_id);
    const duplicateEmployeeId = teachers.some((row) => {
      if (row.id === editTargetId) return false;
      return (
        normalizeComparableValue(row.employee_id) === normalizedEmployeeId ||
        normalizeComparableValue(row.employee_number) === normalizedEmployeeId
      );
    });
    if (duplicateEmployeeId) {
      return {
        tone: "error",
        message:
          "This employee number is already assigned to another teacher. Use a different employee number.",
      };
    }
  }

  return null;
}

export function emptyTeacherCreateForm(): UserForm {
  return {
    ...EMPTY_FORM,
    teaching_assignments: [createTeacherAssignmentDraft()],
  };
}

export function buildTeacherAssignmentDraftId(seed?: number) {
  if (typeof seed === "number") {
    return `assignment-${seed}-${Date.now()}`;
  }

  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTeacherAssignmentDraft(): TeacherAssignmentDraft {
  return {
    id: buildTeacherAssignmentDraftId(),
    classId: "",
    subjectId: "",
  };
}

export function toggleSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

export function dedupeTeacherAssignments(values: TeacherAssignmentDraft[]) {
  const seen = new Set<string>();
  const nextValues: Array<{ classId: string; subjectId: string }> = [];

  for (const value of values) {
    const classId = String(value.classId || "").trim();
    const subjectId = String(value.subjectId || "").trim();
    if (!classId || !subjectId) {
      continue;
    }

    const key = `${classId}:${subjectId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    nextValues.push({ classId, subjectId });
  }

  return nextValues;
}

export function buildSelectedSubjectSummary(
  subjectIds: string[],
  subjectNameById: Record<string, string>,
) {
  const names = subjectIds
    .map((subjectId) => String(subjectNameById[subjectId] || "").trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "";
}

export function normalizeComparableValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function sortOptionList<T extends { label: string }>(values: T[]) {
  return [...values].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

export function toClassOptions(rows: unknown): ClassOption[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row: any) => {
    const id = typeof row?.id === "string" ? row.id : "";
    const className = typeof row?.name === "string" ? row.name.trim() : "";
    const gradeName =
      typeof row?.grades?.name === "string" ? row.grades.name.trim() : "";
    const label =
      [gradeName, className].filter(Boolean).join(" - ") ||
      className ||
      gradeName;
    return id && label ? [{ id, label }] : [];
  });
}

export function findClassId(options: ClassOption[], legacyLabel: string) {
  const normalizedLegacyLabel = legacyLabel.trim().toLowerCase();
  if (!normalizedLegacyLabel) {
    return "";
  }

  return (
    options.find(
      (option) => option.label.trim().toLowerCase() === normalizedLegacyLabel,
    )?.id || ""
  );
}

export function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-ZM", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function buildDetailBio(detailData: GenericRow, detailRole: string) {
  if (detailRole === "teacher") {
    return `${detailData.department || "Academic"} teacher${detailData.specialization ? ` specializing in ${detailData.specialization}` : ""}. ${detailData.tenure?.label ? `Tenure: ${detailData.tenure.label}.` : "Teaching profile ready for timetable, class, and assessment oversight."}`;
  }

  if (detailRole === "student") {
    return `${detailData.className || "Unassigned class"} student${detailData.admissionNumber ? ` with student number ${detailData.admissionNumber}` : ""}. Attendance, results, guardians, and payments are summarized below.`;
  }

  return `${detailData.relationType || "Guardian"} profile${detailData.occupation ? `, ${detailData.occupation}` : ""}. Linked children, alerts, and family account details are grouped here.`;
}

export function buildPrimaryDate(detailData: GenericRow, detailRole: string) {
  if (detailRole === "teacher")
    return detailData.hireDate
      ? formatDateLabel(detailData.hireDate)
      : "No hire date";
  if (detailRole === "student")
    return detailData.updatedAt
      ? formatDateLabel(detailData.updatedAt)
      : "Recently updated";
  return detailData.updatedAt
    ? formatDateLabel(detailData.updatedAt)
    : "Recently updated";
}

export function buildPrimaryAssignment(
  detailData: GenericRow,
  detailRole: string,
) {
  if (detailRole === "teacher")
    return (
      detailData.specialization ||
      detailData.department ||
      "No subject assigned"
    );
  if (detailRole === "student")
    return detailData.className || "No class assigned";
  return `${detailData.linkedChildren?.length || 0} linked children`;
}
