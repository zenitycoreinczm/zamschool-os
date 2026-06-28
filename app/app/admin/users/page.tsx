"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getDisplayName } from "@/lib/profile-utils";
import { adminApiJson } from "@/lib/admin-browser-api";
import {
  Award,
  Bell,
  BookOpen,
  CalendarDays,
  Clock,
  Eye,
  GraduationCap,
  HeartPulse,
  Home,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Search,
  School,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AccountsSetupGuide } from "@/components/admin/AccountsSetupGuide";
import { AdminPageHero } from "@/components/admin/AdminPageHero";
import { StaffInvitePanel } from "@/components/admin/StaffInvitePanel";
import { useWorkspaceContext } from "@/components/WorkspaceContextProvider";
import { normalizeRole } from "@/lib/roles";

type TabKey = "students" | "teachers" | "parents";
type GenericRow = Record<string, any>;

type UserForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  status: string;
  admission_number: string;
  class_id: string;
  enrollment_date: string;
  employee_id: string;
  department: string;
  specialization: string;
  hire_date: string;
  relation_type: string;
  occupation: string;
  specialization_subject_ids: string[];
  teaching_assignments: TeacherAssignmentDraft[];
  supervised_class_ids: string[];
};

type ParentLinkTarget = { id: string; name: string; admission?: string };
type ClassOption = { id: string; label: string };
type SubjectOption = { id: string; label: string };
type TeacherAssignmentDraft = {
  id: string;
  classId: string;
  subjectId: string;
};
type TeacherInlineSubjectSection = "specializations" | "assignments" | null;
type TeacherInlineClassSection = "assignments" | "supervised" | null;
type FormNotice = {
  tone: "error" | "info";
  message: string;
};

const PAGE_SIZE = 10;
const tabs: Array<{ key: TabKey; label: string; icon: any }> = [
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "teachers", label: "Teachers", icon: Users },
  { key: "parents", label: "Parents", icon: UsersRound },
];

const MANAGED_ACCOUNT_ROLES = new Set(["student", "teacher", "parent"]);

const EMPTY_FORM: UserForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "",
  status: "ACTIVE",
  admission_number: "",
  class_id: "",
  enrollment_date: "",
  employee_id: "",
  department: "",
  specialization: "",
  hire_date: "",
  relation_type: "Mother",
  occupation: "",
  specialization_subject_ids: [],
  teaching_assignments: [],
  supervised_class_ids: [],
};

// Admin-subtype roles that shouldn't be using the principal user console.
// They get bounced to their own scoped dashboard on mount.
const ADMIN_SUBTYPE_ROLE_DASHBOARDS: Record<string, string> = {
  DEPUTY_HEAD: "/app/deputy-head",
  BURSAR: "/app/bursar",
  GUIDANCE_OFFICE: "/app/guidance",
  ACADEMIC_ADMIN: "/app/academic-admin",
  HR_ADMIN: "/app/hr-admin",
  ICT_ADMIN: "/app/ict-admin",
  DISCIPLINE_ADMIN: "/app/discipline-admin",
  REGISTRAR: "/app/registrar",
};

function adminSubtypeHomePath(role: string): string | null {
  return ADMIN_SUBTYPE_ROLE_DASHBOARDS[role] ?? null;
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { role: workspaceRole } = useWorkspaceContext();
  const normalizedWorkspaceRole = normalizeRole(workspaceRole);
  // /app/admin/users is the principal-only user console. Other admin
  // subtypes (HR, ICT, discipline, registrar, guidance, deputy_head, etc.)
  // have their own scoped routes. Bounce them to their own dashboard so
  // they never land on controls that don't apply to their role.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const role = normalizedWorkspaceRole;
    if (!role) return;
    const isPrincipal =
      role === "PRINCIPAL" ||
      role === "SUPER_ADMIN" ||
      role === "HEAD_TEACHER";
    if (isPrincipal) return;
    const fallback = adminSubtypeHomePath(role);
    if (fallback && fallback !== "/app/admin/users") {
      router.replace(fallback);
    }
  }, [normalizedWorkspaceRole, router]);
  // Only the Head Teacher (PRINCIPAL) and platform super admin can invite
  // staff members.  All other roles see only the student/teacher/parent
  // registration interface.
  const canInviteStaff =
    normalizedWorkspaceRole === "PRINCIPAL" ||
    normalizedWorkspaceRole === "SUPER_ADMIN";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("students");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  const [students, setStudents] = useState<GenericRow[]>([]);
  const [teachers, setTeachers] = useState<GenericRow[]>([]);
  const [parentsProfiles, setParentsProfiles] = useState<GenericRow[]>([]);
  const [parentsMetaMap, setParentsMetaMap] = useState<
    Record<string, GenericRow>
  >({});

  const [pageByTab, setPageByTab] = useState<Record<TabKey, number>>({
    students: 1,
    teachers: 1,
    parents: 1,
  });

  const [openForm, setOpenForm] = useState(false);
  const [editTarget, setEditTarget] = useState<GenericRow | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
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

  const [parentsTable, setParentsTable] = useState<string | null>(null);
  const [parentStudentsTable, setParentStudentsTable] = useState<string | null>(
    null,
  );

  const [openLinkModal, setOpenLinkModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState<GenericRow | null>(null);
  const [linkSearch, setLinkSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkedStudentIds, setLinkedStudentIds] = useState<string[]>([]);
  const [newCredentials, setNewCredentials] = useState<{
    email: string;
    password: string;
    emailSent?: boolean;
  } | null>(null);
  const [detailTarget, setDetailTarget] = useState<GenericRow | null>(null);
  const [detailData, setDetailData] = useState<GenericRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState<string | null>(
    null,
  );
  const [staffInvitesExpanded, setStaffInvitesExpanded] = useState(true);

  const classNameById = useMemo(
    () =>
      Object.fromEntries(
        classOptions.map((option) => [option.id, option.label]),
      ),
    [classOptions],
  );
  const subjectNameById = useMemo(
    () =>
      Object.fromEntries(
        subjectOptions.map((option) => [option.id, option.label]),
      ),
    [subjectOptions],
  );

  useEffect(() => {
    const nextQuery = (searchParams.get("q") || "").trim();
    if (nextQuery) {
      setSearch(nextQuery);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedSearch(search.trim().toLowerCase()),
      250,
    );
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentRows = useMemo(() => {
    const rows =
      activeTab === "students"
        ? students
        : activeTab === "teachers"
          ? teachers
          : parentsProfiles;
    if (!debouncedSearch) return rows;

    return rows.filter((row) => {
      const haystack = [
        getDisplayName(row),
        row.email,
        row.phone,
        row.admission_number,
        classNameById[row.class_id],
        row.employee_id,
        row.department,
        row.specialization,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [
    activeTab,
    students,
    teachers,
    parentsProfiles,
    debouncedSearch,
    classNameById,
  ]);

  const paginatedRows = useMemo(() => {
    const page = pageByTab[activeTab] || 1;
    const start = (page - 1) * PAGE_SIZE;
    return currentRows.slice(start, start + PAGE_SIZE);
  }, [currentRows, pageByTab, activeTab]);

  const totalPages = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE));

  const accountOverview = useMemo(() => {
    const activeStudents = students.filter(
      (row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE",
    ).length;
    const activeTeachers = teachers.filter(
      (row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE",
    ).length;
    const activeParents = parentsProfiles.filter(
      (row) => String(row.status || "ACTIVE").toUpperCase() === "ACTIVE",
    ).length;

    return {
      students: students.length,
      teachers: teachers.length,
      parents: parentsProfiles.length,
      activeStudents,
      activeTeachers,
      activeParents,
    };
  }, [students, teachers, parentsProfiles]);

  useEffect(() => {
    if ((pageByTab[activeTab] || 1) > totalPages) {
      setPageByTab((prev) => ({ ...prev, [activeTab]: totalPages }));
    }
  }, [activeTab, pageByTab, totalPages]);

  async function init() {
    setLoading(true);
    try {
      const schoolBody = await adminApiJson<{
        data?: { profile?: { school_id?: string | null } };
      }>("/api/admin/school");
      const sid = schoolBody.data?.profile?.school_id;
      if (!sid) throw new Error("No school linked to this account");

      setSchoolId(sid);
      setParentsTable("parents");
      setParentStudentsTable("parent_students");

      const [nextClassOptions] = await Promise.all([
        fetchClassOptions(),
        fetchSubjectOptions(),
      ]);
      await fetchAll(sid, "parents", nextClassOptions);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function fetchClassOptions() {
    const body = await adminApiJson<{ data?: any[] }>("/api/admin/classes");

    const options = toClassOptions(body?.data);
    setClassOptions(options);
    return options;
  }

  async function fetchSubjectOptions() {
    const body = await adminApiJson<{ data?: any[] }>("/api/admin/subjects");
    const options = Array.isArray(body?.data)
      ? body.data.flatMap((row) => {
          const id = typeof row?.id === "string" ? row.id : "";
          const name = typeof row?.name === "string" ? row.name.trim() : "";
          return id && name ? [{ id, label: name }] : [];
        })
      : [];

    setSubjectOptions(options);
    return options;
  }

  async function createSubjectInline() {
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
      const response = await adminApiJson<{ data?: any }>(
        "/api/admin/subjects",
        {
          method: "POST",
          body: JSON.stringify({
            name,
            code: code || undefined,
          }),
        },
      );
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

      setSubjectOptions((current) => sortOptionList([...current, option]));
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
    } catch (err: any) {
      setFormNotice({
        tone: "error",
        message: err?.message || "Failed to create subject",
      });
      toast.error(err?.message || "Failed to create subject", {
        id: loadingToast,
      });
    } finally {
      setCreatingSubjectInline(false);
    }
  }

  async function createClassInline() {
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
      const response = await adminApiJson<{ data?: any }>(
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

      setClassOptions((current) => sortOptionList([...current, option]));
      setSelectedSupervisedClassId(option.id);
      setClassInlineDraft({ name: "", gradeLevel: "", capacity: "30" });
      setOpenCreateClassInlineSection(null);
      setFormNotice({
        tone: "info",
        message: `${option.label} was created and is now available for teaching assignments and class-teacher roles.`,
      });
      toast.success("Class added", { id: loadingToast });
    } catch (err: any) {
      setFormNotice({
        tone: "error",
        message: err?.message || "Failed to create class",
      });
      toast.error(err?.message || "Failed to create class", {
        id: loadingToast,
      });
    } finally {
      setCreatingClassInline(false);
    }
  }

  async function fetchAll(
    sid: string,
    resolvedParentsTable?: string | null,
    nextClassOptions?: ClassOption[],
  ) {
    void sid;
    void resolvedParentsTable;
    void nextClassOptions;
    const body = await adminApiJson<{
      data?: {
        students?: GenericRow[];
        teachers?: GenericRow[];
        parents?: GenericRow[];
        parentRows?: GenericRow[];
      };
    }>("/api/admin/users");

    const merged = {
      students: body.data?.students || [],
      teachers: body.data?.teachers || [],
      parents: body.data?.parents || [],
    };

    setStudents(merged.students);
    setTeachers(merged.teachers);
    setParentsProfiles(merged.parents);

    if (Array.isArray(body.data?.parentRows)) {
      const mapped: Record<string, GenericRow> = {};
      for (const row of body.data.parentRows || []) {
        mapped[row.profile_id] = row;
      }
      setParentsMetaMap(mapped);
    } else {
      setParentsMetaMap({});
    }
  }

  function resetTeacherInlineSetupState() {
    setFormNotice(null);
    setSelectedSpecializationSubjectId("");
    setSelectedSupervisedClassId("");
    setOpenCreateSubjectInlineSection(null);
    setOpenCreateClassInlineSection(null);
    setCreatingSubjectInline(false);
    setCreatingClassInline(false);
    setSubjectInlineDraft({ name: "", code: "" });
    setClassInlineDraft({ name: "", gradeLevel: "", capacity: "30" });
  }

  function openCreate() {
    setEditTarget(null);
    setHydratingTeacherAssignments(false);
    resetTeacherInlineSetupState();
    setForm(
      activeTab === "teachers"
        ? {
            ...EMPTY_FORM,
            teaching_assignments: [createTeacherAssignmentDraft()],
          }
        : EMPTY_FORM,
    );
    setOpenForm(true);
  }

  async function openEdit(row: GenericRow) {
    setEditTarget(row);
    resetTeacherInlineSetupState();
    const parentMeta = parentsMetaMap[row.id] || {};
    const nextForm: UserForm = {
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      email: row.email || "",
      phone: row.phone || "",
      gender: row.gender || "",
      status: row.status || "ACTIVE",
      admission_number: row.admission_number || "",
      class_id:
        row.class_id ||
        findClassId(classOptions, row.class_name || row.class || ""),
      enrollment_date: row.enrollment_date || row.enrolled_at || "",
      employee_id: row.employee_id || "",
      department: row.department || "",
      specialization: row.specialization || "",
      hire_date: row.hire_date || row.hired_at || "",
      relation_type: parentMeta.relation_type || "Mother",
      occupation: parentMeta.occupation || row.occupation || "",
      specialization_subject_ids: [],
      teaching_assignments: [],
      supervised_class_ids: [],
    };
    setForm(nextForm);
    setOpenForm(true);

    if (activeTab !== "teachers") {
      return;
    }

    setHydratingTeacherAssignments(true);
    try {
      const body = await adminApiJson<{ data?: GenericRow }>(
        `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=teacher`,
      );
      const teacherDetail = body?.data || {};

      setForm((current) => ({
        ...current,
        specialization: String(
          teacherDetail.specialization || current.specialization || "",
        ),
        specialization_subject_ids: Array.isArray(
          teacherDetail.specializationSubjectIds,
        )
          ? teacherDetail.specializationSubjectIds.filter(
              (value: unknown): value is string =>
                typeof value === "string" && value.length > 0,
            )
          : [],
        teaching_assignments: Array.isArray(teacherDetail.teachingAssignments)
          ? teacherDetail.teachingAssignments.flatMap(
              (assignment: any, index: number) => {
                const classId = String(assignment?.classId || "").trim();
                const subjectId = String(assignment?.subjectId || "").trim();
                if (!classId || !subjectId) {
                  return [];
                }

                return [
                  {
                    id: buildTeacherAssignmentDraftId(index),
                    classId,
                    subjectId,
                  },
                ];
              },
            )
          : [],
        supervised_class_ids: Array.isArray(teacherDetail.supervisedClassIds)
          ? teacherDetail.supervisedClassIds.filter(
              (value: unknown): value is string =>
                typeof value === "string" && value.length > 0,
            )
          : [],
      }));
    } catch (err: any) {
      toast.error(err?.message || "Failed to load teacher assignments");
    } finally {
      setHydratingTeacherAssignments(false);
    }
  }

  async function handleSave() {
    if (!schoolId) return;
    setFormNotice(null);
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.email.trim()
    ) {
      setFormNotice({
        tone: "error",
        message:
          "First name, last name, and email are required before you can save this user.",
      });
      toast.error("First name, last name, and email are required");
      return;
    }

    if (activeTab === "students" && !form.admission_number.trim()) {
      setFormNotice({
        tone: "error",
        message:
          "Student number is required before you can create this student.",
      });
      toast.error("Student number is required");
      return;
    }

    if (activeTab === "students" && !form.class_id.trim()) {
      setFormNotice({
        tone: "error",
        message: classOptions.length
          ? "Select a class for this student before saving."
          : "Create at least one class under Classes before adding students.",
      });
      toast.error("Class assignment is required for every student");
      return;
    }

    if (activeTab === "teachers" && !form.employee_id.trim()) {
      setFormNotice({
        tone: "error",
        message:
          "Employee number is required before you can create this teacher.",
      });
      toast.error("Employee number is required");
      return;
    }
    if (
      activeTab === "teachers" &&
      form.teaching_assignments.some(
        (assignment) =>
          !String(assignment.classId || "").trim() ||
          !String(assignment.subjectId || "").trim(),
      )
    ) {
      setFormNotice({
        tone: "error",
        message:
          "Every teaching assignment needs both a class and a subject before the teacher can be saved.",
      });
      toast.error("Each teaching assignment needs both a class and a subject");
      return;
    }

    const teacherClassAssignments = dedupeTeacherAssignments(
      form.teaching_assignments,
    );
    if (
      activeTab === "teachers" &&
      teacherClassAssignments.length === 0 &&
      form.supervised_class_ids.length === 0
    ) {
      setFormNotice({
        tone: "error",
        message:
          "Assign this teacher to at least one class — add a teaching row (class + subject) or a class teacher responsibility.",
      });
      toast.error("Teacher must be assigned to at least one class");
      return;
    }

    const normalizedEmail = form.email.trim().toLowerCase();
    const duplicateEmail = [...students, ...teachers, ...parentsProfiles].some(
      (row) => {
        if (row.id === editTarget?.id) {
          return false;
        }
        return normalizeComparableValue(row.email) === normalizedEmail;
      },
    );
    if (duplicateEmail) {
      const message =
        "This email address is already linked to another user. Use a different email before creating the account.";
      setFormNotice({ tone: "error", message });
      toast.error(message);
      return;
    }

    if (activeTab === "teachers") {
      const normalizedEmployeeId = normalizeComparableValue(form.employee_id);
      const duplicateEmployeeId = teachers.some((row) => {
        if (row.id === editTarget?.id) {
          return false;
        }
        return (
          normalizeComparableValue(row.employee_id) === normalizedEmployeeId ||
          normalizeComparableValue(row.employee_number) === normalizedEmployeeId
        );
      });

      if (duplicateEmployeeId) {
        const message =
          "This employee number is already assigned to another teacher. Use a different employee number.";
        setFormNotice({ tone: "error", message });
        toast.error(message);
        return;
      }
    }

    const roleValue =
      activeTab === "students"
        ? "student"
        : activeTab === "teachers"
          ? "teacher"
          : "parent";
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

    setSaving(true);
    const t = toast.loading(
      editTarget ? "Updating user..." : "Creating user...",
    );

    let credentialsEmailSent = false;

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
            phone: form.phone.trim() || null,
            gender: form.gender || null,
            status: form.status || "ACTIVE",
            admissionNumber: form.admission_number.trim() || null,
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
            phone: form.phone.trim() || null,
            profileExtras:
              activeTab === "students"
                ? {
                    admission_number: form.admission_number.trim(),
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
          setNewCredentials({
            email: form.email.trim().toLowerCase(),
            password: String(createBody.temporaryPassword),
            emailSent: credentialsEmailSent,
          });
        }
      }

      await fetchAll(schoolId, parentsTable);
      setOpenForm(false);
      setEditTarget(null);
      setForm(EMPTY_FORM);
      setFormNotice(null);
      toast.success(
        editTarget
          ? "User updated"
          : credentialsEmailSent
            ? "User created — sign-in details emailed"
            : "User created — copy the temporary password to share",
        { id: t },
      );
    } catch (err: any) {
      setFormNotice({
        tone: "error",
        message: err?.message || "Failed to save user",
      });
      toast.error(err?.message || "Failed to save user", { id: t });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: GenericRow) {
    if (!schoolId) return;
    const ok = window.confirm(
      `Delete ${getDisplayName(row)}? This action cannot be undone.`,
    );
    if (!ok) return;

    setDeleting(row.id);
    const t = toast.loading("Deleting user...");
    try {
      const role =
        activeTab === "students"
          ? "student"
          : activeTab === "teachers"
            ? "teacher"
            : "parent";
      await adminApiJson(
        `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=${role}`,
        {
          method: "DELETE",
        },
      );

      await fetchAll(schoolId, parentsTable);
      toast.success("User deleted", { id: t });
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete user", { id: t });
    } finally {
      setDeleting(null);
    }
  }

  async function openParentLinkManager(row: GenericRow) {
    setSelectedParent(row);
    setLinkSearch("");
    setOpenLinkModal(true);
    await refreshLinkedStudentIds(row.id);
  }

  async function toggleLinkStudent(studentId: string, shouldLink: boolean) {
    if (!selectedParent) return;

    setLinking(true);
    const t = toast.loading(
      shouldLink ? "Linking student..." : "Removing link...",
    );

    try {
      await adminApiJson("/api/admin/relationships", {
        method: "POST",
        body: JSON.stringify({
          action: shouldLink ? "link_parent_student" : "unlink_parent_student",
          parentProfileId: selectedParent.id,
          studentProfileId: studentId,
        }),
      });

      setLinkedStudentIds((prev) =>
        shouldLink
          ? Array.from(new Set([...prev, studentId]))
          : prev.filter((id) => id !== studentId),
      );

      toast.success(shouldLink ? "Student linked" : "Link removed", { id: t });
    } catch (err: any) {
      toast.error(err?.message || "Failed to update link", { id: t });
    } finally {
      setLinking(false);
    }
  }

  async function refreshLinkedStudentIds(parentProfileId: string) {
    try {
      const response = await adminApiJson<{
        data?: { parents?: GenericRow[] };
      }>("/api/admin/relationships");
      const parents = Array.isArray(response?.data?.parents)
        ? response.data.parents
        : [];
      const matchedParent = parents.find(
        (parent) => parent.profileId === parentProfileId,
      );
      const nextLinkedIds = Array.isArray(
        matchedParent?.linkedStudentProfileIds,
      )
        ? matchedParent.linkedStudentProfileIds.filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          )
        : [];

      setLinkedStudentIds(nextLinkedIds);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load linked students");
      setLinkedStudentIds([]);
    }
  }

  async function openDetail(row: GenericRow) {
    const role =
      activeTab === "students"
        ? "student"
        : activeTab === "teachers"
          ? "teacher"
          : "parent";
    setDetailTarget(row);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const body = await adminApiJson<{ data?: GenericRow }>(
        `/api/admin/users?profileId=${encodeURIComponent(row.id)}&role=${encodeURIComponent(role)}`,
      );
      setDetailData(body?.data || null);
    } catch (err: any) {
      setDetailError(err?.message || "Failed to load user details");
    } finally {
      setDetailLoading(false);
    }
  }

  const linkCandidates = useMemo<ParentLinkTarget[]>(() => {
    const all = students.map((s) => ({
      id: s.id,
      name: getDisplayName(s),
      admission: s.admission_number,
    }));

    const q = linkSearch.trim().toLowerCase();
    if (!q) return all;

    return all.filter((s) =>
      `${s.name} ${s.admission || ""}`.toLowerCase().includes(q),
    );
  }, [students, linkSearch]);

  const detailRole = String(
    detailData?.role ||
      detailTarget?.role ||
      (activeTab === "students"
        ? "student"
        : activeTab === "teachers"
          ? "teacher"
          : "parent"),
  )
    .trim()
    .toLowerCase();
  const canResetTemporaryPassword = Boolean(
    detailTarget && MANAGED_ACCOUNT_ROLES.has(detailRole),
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
        <span className="text-sm text-slate-500">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHero
        eyebrow="School directory"
        title="Users & accounts"
        description={
          canInviteStaff
            ? "Add students, parents, and teachers with the Add button and tabs below. Invite Deputy Head, Bursar, School Administrator, and other office roles in the Staff invitations section — not through Add student/teacher/parent."
            : "Register students, parents, and teachers for your school. Use the Add button and tabs below to create accounts and assign classes."
        }
        stats={[
          {
            label: "Students",
            value: accountOverview.students,
            hint: `${accountOverview.activeStudents} active`,
            icon: GraduationCap,
            tone: "sky",
          },
          {
            label: "Teachers",
            value: accountOverview.teachers,
            hint: `${accountOverview.activeTeachers} active`,
            icon: Users,
            tone: "violet",
          },
          {
            label: "Parents",
            value: accountOverview.parents,
            hint: `${accountOverview.activeParents} active`,
            icon: UsersRound,
            tone: "amber",
          },
          ...(canInviteStaff
            ? [
                {
                  label: "Office staff",
                  value: "Invites",
                  hint: "Section below ↓",
                  icon: ShieldCheck,
                  tone: "emerald" as const,
                },
              ]
            : []),
        ]}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPageByTab((prev) => ({ ...prev, [activeTab]: 1 }));
                }}
                placeholder="Search directory"
                className="w-56 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-300/50"
              />
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" />
              Add{" "}
              {activeTab === "students"
                ? "student"
                : activeTab === "teachers"
                  ? "teacher"
                  : "parent"}
            </button>
          </>
        }
      />

      {canInviteStaff && (
        <AccountsSetupGuide
          onOpenStaffInvites={() => {
            setStaffInvitesExpanded(true);
            document
              .getElementById("staff-invitations")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        />
      )}

      {canInviteStaff && (
        <StaffInvitePanel
          expanded={staffInvitesExpanded}
          onExpandedChange={setStaffInvitesExpanded}
        />
      )}

      <div className="rounded-2xl border border-gray-200 bg-white p-1.5 shadow-sm">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map((tab) => {
            const active = tab.key === activeTab;
            const count =
              tab.key === "students"
                ? accountOverview.students
                : tab.key === "teachers"
                  ? accountOverview.teachers
                  : accountOverview.parents;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch("");
                }}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-emerald-600 font-semibold text-white shadow-sm"
                    : "font-medium text-slate-600 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Phone
                </th>
                {activeTab === "students" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Student No
                  </th>
                ) : null}
                {activeTab === "students" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Class
                  </th>
                ) : null}
                {activeTab === "teachers" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Employee No
                  </th>
                ) : null}
                {activeTab === "teachers" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Department
                  </th>
                ) : null}
                {activeTab === "parents" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Relation
                  </th>
                ) : null}
                {activeTab === "parents" ? (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Occupation
                  </th>
                ) : null}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      activeTab === "students" ||
                      activeTab === "teachers" ||
                      activeTab === "parents"
                        ? 9
                        : 7
                    }
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const parentMeta = parentsMetaMap[row.id] || {};
                  return (
                    <tr
                      key={row.id}
                      className="border-t border-gray-100 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {getDisplayName(row)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.email || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {row.phone || "-"}
                      </td>
                      {activeTab === "students" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {row.admission_number || "-"}
                        </td>
                      ) : null}
                      {activeTab === "students" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {classNameById[row.class_id] ||
                            row.class_name ||
                            row.class ||
                            "-"}
                        </td>
                      ) : null}
                      {activeTab === "teachers" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {row.employee_id || "-"}
                        </td>
                      ) : null}
                      {activeTab === "teachers" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {row.department || "-"}
                        </td>
                      ) : null}
                      {activeTab === "parents" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {parentMeta.relation_type || "-"}
                        </td>
                      ) : null}
                      {activeTab === "parents" ? (
                        <td className="px-4 py-3 text-slate-600">
                          {parentMeta.occupation || row.occupation || "-"}
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => quickToggleStatus(row)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            String(row.status || "ACTIVE").toUpperCase() ===
                            "ACTIVE"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          {String(row.status || "ACTIVE").toUpperCase()}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-2">
                          {activeTab === "parents" &&
                          parentsTable &&
                          parentStudentsTable ? (
                            <button
                              onClick={() => openParentLinkManager(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-gray-50 transition-colors"
                            >
                              <Users className="w-3.5 h-3.5" /> Link Students
                            </button>
                          ) : null}
                          <button
                            onClick={() => openDetail(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-gray-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Details
                          </button>
                          <button
                            onClick={() => openEdit(row)}
                            className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 grid place-items-center hover:bg-slate-200 transition-colors"
                            aria-label={`Edit ${getDisplayName(row)}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(row)}
                            disabled={deleting === row.id}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center hover:bg-red-100 disabled:opacity-60 transition-colors"
                            aria-label={`Delete ${getDisplayName(row)}`}
                          >
                            {deleting === row.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {paginatedRows.length} of {currentRows.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setPageByTab((prev) => ({
                  ...prev,
                  [activeTab]: Math.max(1, (prev[activeTab] || 1) - 1),
                }))
              }
              disabled={(pageByTab[activeTab] || 1) <= 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-slate-600">
              Page {pageByTab[activeTab] || 1} / {totalPages}
            </span>
            <button
              onClick={() =>
                setPageByTab((prev) => ({
                  ...prev,
                  [activeTab]: Math.min(totalPages, (prev[activeTab] || 1) + 1),
                }))
              }
              disabled={(pageByTab[activeTab] || 1) >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {openForm ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-5xl max-h-[92vh] min-h-0 overflow-hidden rounded-[32px] bg-white border border-slate-200 shadow-2xl shadow-slate-900/10 flex flex-col"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-slate-50 px-6 py-5">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {editTarget ? "Edit" : "Create"}{" "}
                    {activeTab === "students"
                      ? "Student"
                      : activeTab === "teachers"
                        ? "Teacher"
                        : "Parent"}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    {activeTab === "teachers"
                      ? "Set up the teacher profile, specializations, teaching assignments, and class teacher responsibilities in one guided flow."
                      : "Complete the user profile details and save the account."}
                  </p>
                  {formNotice ? <FormNoticeBanner notice={formNotice} /> : null}
                </div>
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="w-10 h-10 rounded-2xl border border-slate-200 bg-white grid place-items-center text-slate-600 hover:bg-slate-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-4">
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
                    onChange={(v) => setForm((p) => ({ ...p, first_name: v }))}
                    required
                  />
                  <Field
                    label="Last name"
                    value={form.last_name}
                    onChange={(v) => setForm((p) => ({ ...p, last_name: v }))}
                    required
                  />
                  <Field
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                    required
                  />
                  <Field
                    label="Phone"
                    value={form.phone}
                    onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                  />
                  <SelectField
                    label="Gender"
                    value={form.gender}
                    onChange={(v) => setForm((p) => ({ ...p, gender: v }))}
                    options={["", "male", "female"]}
                  />
                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(v) => setForm((p) => ({ ...p, status: v }))}
                    options={["ACTIVE", "INACTIVE", "TRANSFERRED", "WITHDRAWN"]}
                  />

                  {activeTab === "students" ? (
                    <>
                      <Field
                        label="Student number"
                        value={form.admission_number}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, admission_number: v }))
                        }
                        required
                      />
                      <SelectOptionField
                        label="Class"
                        value={form.class_id}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, class_id: v }))
                        }
                        options={classOptions}
                        placeholder="Select class (required)"
                        required
                      />
                      <Field
                        label="Enrollment date"
                        type="date"
                        value={form.enrollment_date}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, enrollment_date: v }))
                        }
                      />
                    </>
                  ) : null}

                  {activeTab === "teachers" ? (
                    <>
                      <Field
                        label="Employee number"
                        value={form.employee_id}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, employee_id: v }))
                        }
                        required
                      />
                      <Field
                        label="Department"
                        value={form.department}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, department: v }))
                        }
                      />
                      <Field
                        label="Hire date"
                        type="date"
                        value={form.hire_date}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, hire_date: v }))
                        }
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
                          setForm((p) => ({ ...p, relation_type: v }))
                        }
                      />
                      <Field
                        label="Occupation"
                        value={form.occupation}
                        onChange={(v) =>
                          setForm((p) => ({ ...p, occupation: v }))
                        }
                      />
                    </>
                  ) : null}
                </div>

                {activeTab === "teachers" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Teaching Assignment
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Link this teacher to subject specializations, teaching
                        classes, and class teacher responsibilities.
                      </p>
                    </div>

                    {hydratingTeacherAssignments ? (
                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 flex items-center justify-center gap-3 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
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
                                Choose the subjects this teacher can handle, or
                                add a missing subject without leaving the form.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCreateSubjectInlineSection((current) =>
                                  current === "specializations"
                                    ? null
                                    : "specializations",
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
                                onChange={setSelectedSpecializationSubjectId}
                                options={subjectOptions}
                                placeholder="Select subject"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedSpecializationSubjectId) return;
                                setForm((current) => ({
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
                                setSelectedSpecializationSubjectId("");
                              }}
                              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                              Add to teacher
                            </button>
                          </div>
                          {openCreateSubjectInlineSection ===
                          "specializations" ? (
                            <InlineSubjectCreatorCard
                              draft={subjectInlineDraft}
                              loading={creatingSubjectInline}
                              onChange={setSubjectInlineDraft}
                              onCancel={() =>
                                setOpenCreateSubjectInlineSection(null)
                              }
                              onSubmit={() => void createSubjectInline()}
                            />
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {form.specialization_subject_ids.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                No subject specializations selected yet.
                              </p>
                            ) : (
                              form.specialization_subject_ids.map(
                                (subjectId) => (
                                  <button
                                    key={subjectId}
                                    type="button"
                                    onClick={() =>
                                      setForm((current) => ({
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
                                ),
                              )
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
                                Map the exact classes and subjects this teacher
                                teaches. Each row should answer one clear
                                question: which subject does this teacher handle
                                in this class?
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenCreateClassInlineSection((current) =>
                                    current === "assignments"
                                      ? null
                                      : "assignments",
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
                                  setOpenCreateSubjectInlineSection(
                                    (current) =>
                                      current === "assignments"
                                        ? null
                                        : "assignments",
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
                                  setForm((current) => ({
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
                              onChange={setSubjectInlineDraft}
                              onCancel={() =>
                                setOpenCreateSubjectInlineSection(null)
                              }
                              onSubmit={() => void createSubjectInline()}
                            />
                          ) : null}
                          {openCreateClassInlineSection === "assignments" ? (
                            <InlineClassCreatorCard
                              draft={classInlineDraft}
                              loading={creatingClassInline}
                              onChange={setClassInlineDraft}
                              onCancel={() =>
                                setOpenCreateClassInlineSection(null)
                              }
                              onSubmit={() => void createClassInline()}
                            />
                          ) : null}

                          {form.teaching_assignments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                              No teaching assignments yet. Add the classes and
                              subjects this teacher will handle.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {form.teaching_assignments.map(
                                (assignment, index) => (
                                  <div
                                    key={assignment.id}
                                    className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                                  >
                                    <SelectOptionField
                                      label={`Class ${index + 1}`}
                                      value={assignment.classId}
                                      onChange={(value) =>
                                        setForm((current) => ({
                                          ...current,
                                          teaching_assignments:
                                            current.teaching_assignments.map(
                                              (item) =>
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
                                        setForm((current) => ({
                                          ...current,
                                          teaching_assignments:
                                            current.teaching_assignments.map(
                                              (item) =>
                                                item.id === assignment.id
                                                  ? {
                                                      ...item,
                                                      subjectId: value,
                                                    }
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
                                        setForm((current) => ({
                                          ...current,
                                          teaching_assignments:
                                            current.teaching_assignments.filter(
                                              (item) =>
                                                item.id !== assignment.id,
                                            ),
                                        }))
                                      }
                                      className="inline-flex h-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ),
                              )}
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
                                Choose the classes this teacher supervises as
                                class teacher, or create a missing class inline.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCreateClassInlineSection((current) =>
                                  current === "supervised"
                                    ? null
                                    : "supervised",
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
                                onChange={setSelectedSupervisedClassId}
                                options={classOptions}
                                placeholder="Select class"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedSupervisedClassId) return;
                                setForm((current) => ({
                                  ...current,
                                  supervised_class_ids:
                                    current.supervised_class_ids.includes(
                                      selectedSupervisedClassId,
                                    )
                                      ? current.supervised_class_ids
                                      : [
                                          ...current.supervised_class_ids,
                                          selectedSupervisedClassId,
                                        ],
                                }));
                                setSelectedSupervisedClassId("");
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
                              onChange={setClassInlineDraft}
                              onCancel={() =>
                                setOpenCreateClassInlineSection(null)
                              }
                              onSubmit={() => void createClassInline()}
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
                                    setForm((current) => ({
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
                ) : null}
              </div>

              <div className="shrink-0 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setOpenForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-400 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}{" "}
                  {editTarget
                    ? "Save changes"
                    : `Create ${activeTab === "students" ? "student" : activeTab === "teachers" ? "teacher" : "parent"}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {detailTarget ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/10">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {activeTab === "teachers"
                    ? "Teacher Oversight"
                    : "User Details"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {detailData?.displayName || getDisplayName(detailTarget)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canResetTemporaryPassword ? (
                  <button
                    onClick={() => void resetTemporaryPassword(detailTarget)}
                    disabled={resettingPassword === detailTarget?.id}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                  >
                    {resettingPassword === detailTarget?.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                    Reset temporary password
                  </button>
                ) : null}
                <button
                  onClick={() => {
                    setDetailTarget(null);
                    setDetailData(null);
                    setDetailError(null);
                  }}
                  className="w-9 h-9 rounded-xl bg-slate-100 grid place-items-center text-slate-600 hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-y-auto px-6 py-5">
              {detailLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-600" />
                  <span className="text-sm text-slate-500">
                    Loading user details...
                  </span>
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  {detailError}
                </div>
              ) : detailData ? (
                <>
                  <UserDetailDashboard
                    detailData={detailData}
                    detailTarget={detailTarget}
                    detailRole={detailRole}
                    onEdit={() => {
                      if (detailTarget) openEdit(detailTarget);
                    }}
                  />
                  <div className="hidden" aria-hidden="true">
                    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
                      <div className="rounded-3xl border border-slate-200 bg-slate-950 px-6 py-6 text-white">
                        <p className="text-xs uppercase tracking-[0.24em] text-sky-200/80">
                          {String(detailData.role || activeTab).toUpperCase()}
                        </p>
                        <h3 className="mt-3 text-3xl font-semibold">
                          {detailData.displayName ||
                            getDisplayName(detailTarget)}
                        </h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <DetailMeta
                            label="Email"
                            value={detailData.email || "-"}
                            dark
                          />
                          <DetailMeta
                            label="Status"
                            value={detailData.status || "-"}
                            dark
                          />
                          {detailData.employeeId ? (
                            <DetailMeta
                              label="Employee No"
                              value={detailData.employeeId}
                              dark
                            />
                          ) : null}
                          {detailData.department ? (
                            <DetailMeta
                              label="Department"
                              value={detailData.department}
                              dark
                            />
                          ) : null}
                          {detailData.specialization ? (
                            <DetailMeta
                              label="Specialization"
                              value={detailData.specialization}
                              dark
                            />
                          ) : null}
                          {detailData.tenure?.label ? (
                            <DetailMeta
                              label="Tenure"
                              value={detailData.tenure.label}
                              dark
                            />
                          ) : null}
                          {detailData.className ? (
                            <DetailMeta
                              label="Class"
                              value={detailData.className}
                              dark
                            />
                          ) : null}
                          {detailData.admissionNumber ? (
                            <DetailMeta
                              label="Student No"
                              value={detailData.admissionNumber}
                              dark
                            />
                          ) : null}
                          {detailData.relationType ? (
                            <DetailMeta
                              label="Relation"
                              value={detailData.relationType}
                              dark
                            />
                          ) : null}
                          {detailData.occupation ? (
                            <DetailMeta
                              label="Occupation"
                              value={detailData.occupation}
                              dark
                            />
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        {detailData.oversight?.stats ? (
                          <>
                            <StatCard
                              label="Supervised Classes"
                              value={
                                detailData.oversight.stats.supervisedClasses
                              }
                            />
                            <StatCard
                              label="Teaching Classes"
                              value={detailData.oversight.stats.teachingClasses}
                            />
                            <StatCard
                              label="Weekly Lessons"
                              value={detailData.oversight.stats.weeklyLessons}
                            />
                            <StatCard
                              label="Pending Roll Calls"
                              value={
                                detailData.oversight.stats.pendingRollCalls
                              }
                              tone="warning"
                            />
                          </>
                        ) : detailData.attendance ? (
                          <>
                            <StatCard
                              label="Present"
                              value={detailData.attendance.present || 0}
                            />
                            <StatCard
                              label="Absent"
                              value={detailData.attendance.absent || 0}
                              tone="warning"
                            />
                            <StatCard
                              label="Late"
                              value={detailData.attendance.late || 0}
                            />
                            <StatCard
                              label="Sick"
                              value={detailData.attendance.sick || 0}
                            />
                          </>
                        ) : detailData.alerts ? (
                          <StatCard
                            label="Unread Alerts"
                            value={detailData.alerts.unreadCount || 0}
                          />
                        ) : null}
                      </div>
                    </div>

                    {detailData.oversight ? (
                      <>
                        <div className="grid gap-4 xl:grid-cols-3">
                          <DetailListCard
                            title="Supervised Classes"
                            emptyLabel="No supervised classes"
                            items={detailData.supervisedClasses || []}
                            renderItem={(item: any) => item.name || "Class"}
                          />
                          <DetailListCard
                            title="Teaching Classes"
                            emptyLabel="No teaching classes"
                            items={detailData.assignedClasses || []}
                            renderItem={(item: any) => item.name || "Class"}
                          />
                          <DetailListCard
                            title="Assigned Subjects"
                            emptyLabel="No assigned subjects"
                            items={detailData.assignedSubjects || []}
                            renderItem={(item: any) => item.name || "Subject"}
                          />
                        </div>

                        <div className="grid gap-4 xl:grid-cols-3">
                          <DetailActivityCard
                            title="Recent Attendance Activity"
                            emptyLabel="No attendance activity recorded"
                            items={detailData.oversight.recentAttendance || []}
                            renderBody={(item: any) => (
                              <>
                                <p className="font-medium text-slate-800">
                                  {item.sessionName || "Lesson"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.date
                                    ? formatDateLabel(item.date)
                                    : "No date"}{" "}
                                  · {item.status || "Recorded"}
                                </p>
                              </>
                            )}
                          />
                          <DetailActivityCard
                            title="Recent Assignments"
                            emptyLabel="No assignments created"
                            items={detailData.oversight.recentAssignments || []}
                            renderBody={(item: any) => (
                              <>
                                <p className="font-medium text-slate-800">
                                  {item.title || "Assignment"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.className || "Class"} · Due{" "}
                                  {item.dueDate
                                    ? formatDateLabel(item.dueDate)
                                    : "-"}
                                </p>
                              </>
                            )}
                          />
                          <DetailActivityCard
                            title="Recent Results Activity"
                            emptyLabel="No results entered"
                            items={detailData.oversight.recentResults || []}
                            renderBody={(item: any) => (
                              <>
                                <p className="font-medium text-slate-800">
                                  {item.studentName || "Student"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.subjectName || "Subject"} ·{" "}
                                  {item.score ?? "-"}{" "}
                                  {item.grade ? `(${item.grade})` : ""}
                                </p>
                              </>
                            )}
                          />
                        </div>
                      </>
                    ) : null}

                    {detailData.results?.rows ? (
                      <DetailActivityCard
                        title="Recent Results"
                        emptyLabel="No results available"
                        items={detailData.results.rows}
                        renderBody={(item: any) => (
                          <>
                            <p className="font-medium text-slate-800">
                              {item.subjectName || "Subject"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {item.score ?? "-"}{" "}
                              {item.grade ? `(${item.grade})` : ""} ·{" "}
                              {item.date ? formatDateLabel(item.date) : "-"}
                            </p>
                          </>
                        )}
                      />
                    ) : null}

                    {detailData.guardians?.length ? (
                      <DetailListCard
                        title="Guardians"
                        emptyLabel="No guardians linked"
                        items={detailData.guardians}
                        renderItem={(item: any) =>
                          `${item.name || "Guardian"}${item.relationship ? ` · ${item.relationship}` : ""}`
                        }
                      />
                    ) : null}

                    {detailData.linkedChildren?.length ? (
                      <DetailListCard
                        title="Linked Children"
                        emptyLabel="No linked children"
                        items={detailData.linkedChildren}
                        renderItem={(item: any) =>
                          `${item.name || "Student"}${item.className ? ` · ${item.className}` : ""}`
                        }
                      />
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openLinkModal && selectedParent ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Link Students to {getDisplayName(selectedParent)}
              </h2>
              <button
                onClick={() => setOpenLinkModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                placeholder="Search students by name or number"
                className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div className="max-h-[380px] overflow-auto rounded-xl border border-slate-100 divide-y divide-slate-100">
              {linkCandidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No students found.
                </div>
              ) : (
                linkCandidates.map((student) => {
                  const linked = linkedStudentIds.includes(student.id);
                  return (
                    <div
                      key={student.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {student.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {student.admission || "No student number"}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleLinkStudent(student.id, !linked)}
                        disabled={linking}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          linked
                            ? "bg-red-50 text-red-700 hover:bg-red-100"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        } disabled:opacity-60`}
                      >
                        {linked ? "Unlink" : "Link"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {newCredentials ? (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                New Account Credentials
              </h2>
              <button
                onClick={() => setNewCredentials(null)}
                className="w-8 h-8 rounded-lg bg-slate-100 grid place-items-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              {newCredentials.emailSent
                ? "Sign-in details were emailed when SMTP is configured. You can also copy them below."
                : "Save these credentials and share them securely with the user."}{" "}
              They sign in at{" "}
              <span className="font-medium text-slate-800">/login</span> with
              this one-time temporary password, then must choose a new password
              on first login.
            </p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="text-sm">
                <span className="text-slate-500">Email: </span>
                <span className="font-medium text-slate-800">
                  {newCredentials.email}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-slate-500">
                  Temporary Password (one-time):{" "}
                </span>
                <span className="font-mono font-medium text-slate-800">
                  {newCredentials.password}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={async () => {
                  const text = `Email: ${newCredentials.email}\nTemporary Password (one-time): ${newCredentials.password}\nThe user must change this password on first mobile login.`;
                  try {
                    await navigator.clipboard.writeText(text);
                    toast.success("Credentials copied");
                  } catch {
                    toast.error("Copy failed");
                  }
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Copy
              </button>
              <button
                onClick={() => setNewCredentials(null)}
                className="px-4 py-2 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-400"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  async function quickToggleStatus(row: GenericRow) {
    if (!schoolId) return;

    const current = String(row.status || "ACTIVE").toUpperCase();
    const next = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    try {
      await adminApiJson("/api/admin/users", {
        method: "PUT",
        body: JSON.stringify({
          profileId: row.id,
          role:
            activeTab === "students"
              ? "student"
              : activeTab === "teachers"
                ? "teacher"
                : "parent",
          firstName: row.first_name || "",
          lastName: row.last_name || "",
          email: row.email || "",
          phone: row.phone || null,
          gender: row.gender || null,
          status: next,
          admissionNumber: row.admission_number || null,
          classId: row.class_id || null,
          enrollmentDate: row.enrollment_date || null,
          employeeId: row.employee_id || null,
          department: row.department || null,
          specialization: row.specialization || null,
          hireDate: row.hire_date || null,
          relationType: row.relation_type || null,
          occupation: row.occupation || null,
        }),
      });
      await fetchAll(schoolId, parentsTable);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  }

  async function resetTemporaryPassword(row: GenericRow | null) {
    if (!row?.id) return;

    setResettingPassword(row.id);
    const t = toast.loading("Resetting temporary password...");

    try {
      const body = await adminApiJson<{
        email?: string;
        temporaryPassword?: string;
      }>("/api/admin/users/reset-password", {
        method: "POST",
        body: JSON.stringify({ profileId: row.id }),
      });

      if (!body?.temporaryPassword) {
        throw new Error("Temporary password was not returned");
      }

      setNewCredentials({
        email: String(body.email || row.email || ""),
        password: String(body.temporaryPassword),
      });

      if (schoolId) {
        await fetchAll(schoolId, parentsTable);
      }

      toast.success("Temporary password reset", { id: t });
    } catch (err: any) {
      toast.error(err?.message || "Failed to reset temporary password", {
        id: t,
      });
    } finally {
      setResettingPassword(null);
    }
  }
}

function buildTeacherAssignmentDraftId(seed?: number) {
  if (typeof seed === "number") {
    return `assignment-${seed}-${Date.now()}`;
  }

  return `assignment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createTeacherAssignmentDraft(): TeacherAssignmentDraft {
  return {
    id: buildTeacherAssignmentDraftId(),
    classId: "",
    subjectId: "",
  };
}

function toggleSelection(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function dedupeTeacherAssignments(values: TeacherAssignmentDraft[]) {
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

function buildSelectedSubjectSummary(
  subjectIds: string[],
  subjectNameById: Record<string, string>,
) {
  const names = subjectIds
    .map((subjectId) => String(subjectNameById[subjectId] || "").trim())
    .filter(Boolean);

  return names.length > 0 ? names.join(", ") : "";
}

function normalizeComparableValue(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function sortOptionList<T extends { label: string }>(values: T[]) {
  return [...values].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormNoticeBanner({ notice }: { notice: FormNotice }) {
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
        notice.tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-sky-200 bg-sky-50 text-sky-800"
      }`}
    >
      {notice.message}
    </div>
  );
}

function InlineSubjectCreatorCard({
  draft,
  loading,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { name: string; code: string };
  loading: boolean;
  onChange: (value: { name: string; code: string }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Field
          label="Subject name"
          value={draft.name}
          onChange={(value) => onChange({ ...draft, name: value })}
          required
        />
        <Field
          label="Subject code"
          value={draft.code}
          onChange={(value) => onChange({ ...draft, code: value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create subject
        </button>
      </div>
    </div>
  );
}

function InlineClassCreatorCard({
  draft,
  loading,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { name: string; gradeLevel: string; capacity: string };
  loading: boolean;
  onChange: (value: {
    name: string;
    gradeLevel: string;
    capacity: string;
  }) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Field
          label="Class name"
          value={draft.name}
          onChange={(value) => onChange({ ...draft, name: value })}
          required
        />
        <SelectField
          label="Grade level"
          value={draft.gradeLevel}
          onChange={(value) => onChange({ ...draft, gradeLevel: value })}
          options={[
            "",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
          ]}
        />
        <Field
          label="Capacity"
          type="number"
          value={draft.capacity}
          onChange={(value) => onChange({ ...draft, capacity: value })}
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Create class
        </button>
      </div>
    </div>
  );
}

function ClassSetupNotice() {
  return (
    <section className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-semibold text-slate-900">Set up classes first</p>
      <p className="mt-1 leading-relaxed">
        Students and teachers must be linked to classes.{" "}
        <Link
          href="/app/admin/classes"
          className="font-semibold text-slate-900 underline underline-offset-2"
        >
          Create classes
        </Link>{" "}
        (and subjects for teaching assignments), then return here.
      </p>
    </section>
  );
}

function SelectOptionField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ClassOption[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {required ? <span className="text-slate-900"> *</span> : null}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
      >
        <option value="">{placeholder || "Select an option"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function toClassOptions(rows: unknown): ClassOption[] {
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

function findClassId(options: ClassOption[], legacyLabel: string) {
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

function UserDetailDashboard({
  detailData,
  detailTarget,
  detailRole,
  onEdit,
}: {
  detailData: GenericRow;
  detailTarget: GenericRow | null;
  detailRole: string;
  onEdit: () => void;
}) {
  const displayName = detailData.displayName || getDisplayName(detailTarget);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.12fr_1fr]">
        <div className="rounded-[26px] bg-[#c9f1fb] p-5 text-slate-900">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ProfileAvatar
              name={displayName}
              src={detailData.avatarUrl}
              role={detailRole}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    {String(detailData.role || detailRole).toUpperCase()}
                  </p>
                  <h3 className="mt-2 text-3xl font-semibold tracking-[-0.01em] text-slate-950">
                    {displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onEdit}
                  className="grid h-10 w-10 place-items-center rounded-full bg-slate-900/75 text-white shadow-sm hover:bg-slate-900"
                  aria-label="Edit profile"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                {buildDetailBio(detailData, detailRole)}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniInfo
                  icon={Mail}
                  value={detailData.email || "No email recorded"}
                />
                <MiniInfo
                  icon={ShieldCheck}
                  value={detailData.status || "Status pending"}
                />
                <MiniInfo
                  icon={CalendarDays}
                  value={buildPrimaryDate(detailData, detailRole)}
                />
                <MiniInfo
                  icon={
                    detailRole === "parent"
                      ? Home
                      : detailRole === "student"
                        ? School
                        : BookOpen
                  }
                  value={buildPrimaryAssignment(detailData, detailRole)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {buildProfileStats(detailData, detailRole).map((stat) => (
            <ProfileStat key={stat.label} {...stat} />
          ))}
        </div>
      </div>

      {detailRole === "teacher" ? (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <SchedulePanel
            lessons={detailData.oversight?.recentAttendance || []}
          />
          <ShortcutPanel
            items={[
              "Teacher's Classes",
              "Teacher's Students",
              "Teacher's Lessons",
              "Teacher's Exams",
              "Teacher's Assignments",
            ]}
          />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {detailRole === "teacher" ? (
          <>
            <DetailListCard
              title="Supervised Classes"
              emptyLabel="No supervised classes"
              items={detailData.supervisedClasses || []}
              renderItem={(item: any) => item.name || "Class"}
            />
            <DetailListCard
              title="Teaching Classes"
              emptyLabel="No teaching classes"
              items={detailData.assignedClasses || []}
              renderItem={(item: any) => item.name || "Class"}
            />
            <DetailListCard
              title="Assigned Subjects"
              emptyLabel="No assigned subjects"
              items={detailData.assignedSubjects || []}
              renderItem={(item: any) => item.name || "Subject"}
            />
          </>
        ) : detailRole === "student" ? (
          <>
            <DetailListCard
              title="Guardians"
              emptyLabel="No guardians linked"
              items={detailData.guardians || []}
              renderItem={(item: any) =>
                `${item.name || "Guardian"}${item.relationship ? ` - ${item.relationship}` : ""}`
              }
            />
            <DetailActivityCard
              title="Recent Results"
              emptyLabel="No results available"
              items={detailData.results?.rows || []}
              renderBody={(item: any) => (
                <>
                  <p className="font-medium text-slate-800">
                    {item.subjectName || "Subject"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.score ?? "-"} {item.grade ? `(${item.grade})` : ""} -{" "}
                    {item.date ? formatDateLabel(item.date) : "-"}
                  </p>
                </>
              )}
            />
            <DetailActivityCard
              title="Recent Payments"
              emptyLabel="No payment history"
              items={detailData.finance?.recentPayments || []}
              renderBody={(item: any) => (
                <>
                  <p className="font-medium text-slate-800">
                    {detailData.finance?.currency || "ZMW"} {item.amount ?? 0}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.status || "Payment"} -{" "}
                    {item.date ? formatDateLabel(item.date) : "-"}
                  </p>
                </>
              )}
            />
          </>
        ) : (
          <>
            <DetailListCard
              title="Linked Children"
              emptyLabel="No linked children"
              items={detailData.linkedChildren || []}
              renderItem={(item: any) =>
                `${item.name || "Student"}${item.className ? ` - ${item.className}` : ""}`
              }
            />
            <DetailMetaPanel
              title="Parent Profile"
              rows={[
                ["Relation", detailData.relationType || "-"],
                ["Occupation", detailData.occupation || "-"],
                ["Unread alerts", String(detailData.alerts?.unreadCount || 0)],
              ]}
            />
            <ShortcutPanel
              items={[
                "Children",
                "Attendance",
                "Results",
                "Messages",
                "Payments",
              ]}
            />
          </>
        )}
      </div>

      {detailRole === "teacher" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <DetailActivityCard
            title="Recent Attendance Activity"
            emptyLabel="No attendance activity recorded"
            items={detailData.oversight?.recentAttendance || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.sessionName || "Lesson"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.date ? formatDateLabel(item.date) : "No date"} -{" "}
                  {item.status || "Recorded"}
                </p>
              </>
            )}
          />
          <DetailActivityCard
            title="Recent Assignments"
            emptyLabel="No assignments created"
            items={detailData.oversight?.recentAssignments || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.title || "Assignment"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.className || "Class"} - Due{" "}
                  {item.dueDate ? formatDateLabel(item.dueDate) : "-"}
                </p>
              </>
            )}
          />
          <DetailActivityCard
            title="Recent Results Activity"
            emptyLabel="No results entered"
            items={detailData.oversight?.recentResults || []}
            renderBody={(item: any) => (
              <>
                <p className="font-medium text-slate-800">
                  {item.studentName || "Student"}
                </p>
                <p className="text-xs text-slate-500">
                  {item.subjectName || "Subject"} - {item.score ?? "-"}{" "}
                  {item.grade ? `(${item.grade})` : ""}
                </p>
              </>
            )}
          />
        </div>
      ) : null}
    </div>
  );
}

function ProfileAvatar({
  name,
  src,
  role,
}: {
  name: string;
  src?: string | null;
  role: string;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") ||
    role[0]?.toUpperCase() ||
    "U";
  const [imgBroken, setImgBroken] = useState(false);

  return (
    <div className="h-36 w-36 shrink-0 overflow-hidden rounded-full bg-white/80 shadow-sm ring-8 ring-white/35">
      {src && !imgBroken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgBroken(true)}
        />
      ) : (
        <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-900 to-sky-700 text-4xl font-semibold text-white">
          {initials}
        </div>
      )}
    </div>
  );
}

function MiniInfo({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
      <Icon className="h-4 w-4 shrink-0 text-slate-700" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function ProfileStat({
  label,
  value,
  icon: Icon,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: "blue" | "yellow" | "purple" | "rose";
}) {
  const tones = {
    blue: "bg-sky-50 text-sky-700",
    yellow: "bg-amber-50 text-amber-700",
    purple: "bg-violet-50 text-violet-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div
        className={`mb-3 grid h-9 w-9 place-items-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}

function SchedulePanel({ lessons }: { lessons: any[] }) {
  const visibleLessons = lessons.slice(0, 8);
  const timeLabels = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM"];

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-950">
          Teacher Schedule
        </h3>
        <div className="flex rounded-xl bg-violet-50 p-1 text-xs font-medium text-slate-600">
          <span className="rounded-lg bg-violet-200/70 px-3 py-1.5">
            Work Week
          </span>
          <span className="px-3 py-1.5">Day</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[80px_repeat(4,minmax(0,1fr))] overflow-hidden rounded-2xl border border-slate-100 text-sm">
        {timeLabels.map((time, rowIndex) => (
          <div className="contents" key={time}>
            <div className="border-b border-r border-slate-100 bg-slate-50/70 px-3 py-4 text-xs text-slate-500">
              {time}
            </div>
            {[0, 1, 2, 3].map((columnIndex) => {
              const lesson = visibleLessons[rowIndex * 2 + columnIndex];
              return (
                <div
                  key={`${time}-${columnIndex}`}
                  className="min-h-20 border-b border-r border-slate-100 bg-sky-50/20 p-2"
                >
                  {lesson ? (
                    <div
                      className={`h-full rounded-xl px-3 py-2 ${columnIndex % 3 === 0 ? "bg-sky-100" : columnIndex % 3 === 1 ? "bg-amber-50" : "bg-violet-50"}`}
                    >
                      <p className="text-xs text-slate-500">
                        {lesson.sessionTime || lesson.date || "Recorded"}
                      </p>
                      <p className="mt-1 font-medium text-slate-900">
                        {lesson.sessionName || "Lesson"}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShortcutPanel({ items }: { items: string[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-950">Shortcuts</h3>
      <div className="mt-4 flex flex-wrap gap-3">
        {items.map((item, index) => (
          <span
            key={item}
            className={`rounded-xl px-4 py-3 text-sm font-medium text-slate-600 ${
              index % 3 === 0
                ? "bg-sky-50"
                : index % 3 === 1
                  ? "bg-violet-50"
                  : "bg-amber-50"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function DetailMetaPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildProfileStats(detailData: GenericRow, detailRole: string) {
  if (detailRole === "teacher") {
    return [
      {
        label: "Classes",
        value: detailData.oversight?.stats?.teachingClasses || 0,
        icon: School,
        tone: "blue" as const,
      },
      {
        label: "Lessons",
        value: detailData.oversight?.stats?.weeklyLessons || 0,
        icon: Clock,
        tone: "yellow" as const,
      },
      {
        label: "Assignments",
        value: detailData.oversight?.stats?.assignments || 0,
        icon: BookOpen,
        tone: "purple" as const,
      },
      {
        label: "Roll Calls",
        value: detailData.oversight?.stats?.pendingRollCalls || 0,
        icon: Bell,
        tone: "rose" as const,
      },
    ];
  }

  if (detailRole === "student") {
    return [
      {
        label: "Average",
        value: detailData.results?.average ?? "-",
        icon: Award,
        tone: "blue" as const,
      },
      {
        label: "Present",
        value: detailData.attendance?.present || 0,
        icon: UserCheck,
        tone: "yellow" as const,
      },
      {
        label: "Absent",
        value: detailData.attendance?.absent || 0,
        icon: CalendarDays,
        tone: "purple" as const,
      },
      {
        label: "Balance",
        value: `${detailData.finance?.currency || "ZMW"} ${detailData.finance?.balance || 0}`,
        icon: HeartPulse,
        tone: "rose" as const,
      },
    ];
  }

  return [
    {
      label: "Children",
      value: detailData.linkedChildren?.length || 0,
      icon: UsersRound,
      tone: "blue" as const,
    },
    {
      label: "Unread Alerts",
      value: detailData.alerts?.unreadCount || 0,
      icon: Bell,
      tone: "yellow" as const,
    },
    {
      label: "Relation",
      value: detailData.relationType || "-",
      icon: Home,
      tone: "purple" as const,
    },
    {
      label: "Status",
      value: detailData.status || "-",
      icon: ShieldCheck,
      tone: "rose" as const,
    },
  ];
}

function buildDetailBio(detailData: GenericRow, detailRole: string) {
  if (detailRole === "teacher") {
    return `${detailData.department || "Academic"} teacher${detailData.specialization ? ` specializing in ${detailData.specialization}` : ""}. ${detailData.tenure?.label ? `Tenure: ${detailData.tenure.label}.` : "Teaching profile ready for timetable, class, and assessment oversight."}`;
  }

  if (detailRole === "student") {
    return `${detailData.className || "Unassigned class"} student${detailData.admissionNumber ? ` with student number ${detailData.admissionNumber}` : ""}. Attendance, results, guardians, and payments are summarized below.`;
  }

  return `${detailData.relationType || "Guardian"} profile${detailData.occupation ? `, ${detailData.occupation}` : ""}. Linked children, alerts, and family account details are grouped here.`;
}

function buildPrimaryDate(detailData: GenericRow, detailRole: string) {
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

function buildPrimaryAssignment(detailData: GenericRow, detailRole: string) {
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

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DetailMeta({
  label,
  value,
  dark,
}: {
  label: string;
  value: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"}`}
    >
      <p
        className={`text-[11px] uppercase tracking-[0.18em] ${dark ? "text-sky-100/70" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-medium ${dark ? "text-white" : "text-slate-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

function DetailListCard({
  title,
  items,
  emptyLabel,
  renderItem,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
  renderItem: (item: any) => string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-2">
        {items?.length ? (
          items.map((item, index) => (
            <div
              key={item?.id || `${title}-${index}`}
              className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700"
            >
              {renderItem(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function DetailActivityCard({
  title,
  items,
  emptyLabel,
  renderBody,
}: {
  title: string;
  items: any[];
  emptyLabel: string;
  renderBody: (item: any) => any;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items?.length ? (
          items.map((item, index) => (
            <div
              key={item?.id || `${title}-${index}`}
              className="rounded-2xl border border-slate-100 px-3 py-3"
            >
              {renderBody(item)}
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        )}
      </div>
    </div>
  );
}

function formatDateLabel(value: string) {
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
