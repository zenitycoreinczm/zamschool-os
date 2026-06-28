import { checkFeaturePermission } from "@/lib/feature-permissions";
import { getDisplayName } from "@/lib/profile-utils";
import { roleDatabaseValues, type KnownRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";
import { loadTeacherAssignmentScope } from "@/lib/teacher-assignment-scope-server";
import {
  buildWorkspaceListHref,
  buildWorkspaceUsersHref,
  matchesWorkspaceSearchQuery,
  sanitizeWorkspaceSearchQuery,
  toWorkspaceSearchPattern,
  type WorkspaceSearchResult,
} from "./search";
import type { ActorContext } from "@/lib/server-auth-core";

const RESULT_LIMIT = 6;

type SearchContext = {
  schoolId: string;
  actorProfileId: string;
  role: KnownRole;
};

export async function runWorkspaceSearch(
  context: ActorContext,
  rawQuery: string,
): Promise<WorkspaceSearchResult[]> {
  const query = sanitizeWorkspaceSearchQuery(rawQuery);
  if (query.length < 2 || !context.schoolId) {
    return [];
  }

  const searchContext: SearchContext = {
    schoolId: context.schoolId,
    actorProfileId: context.userId,
    role: context.role,
  };

  const permissionContext = {
    schoolId: context.schoolId,
    role: context.role,
  };

  const tasks: Array<Promise<WorkspaceSearchResult[]>> = [];

  if (await checkFeaturePermission(permissionContext, "users", "read")) {
    tasks.push(searchPeople(searchContext, query));
  } else if (context.role === "TEACHER") {
    tasks.push(searchTeacherStudents(searchContext, query));
  } else if (context.role === "PARENT") {
    tasks.push(searchParentChildren(searchContext, query));
  }

  if (await checkFeaturePermission(permissionContext, "classes", "read")) {
    tasks.push(searchClasses(searchContext, query));
  } else if (context.role === "TEACHER") {
    tasks.push(searchTeacherClasses(searchContext, query));
  }

  if (context.role === "STUDENT") {
    tasks.push(searchStudentAssignments(searchContext, query));
  }

  const canReadUsers = await checkFeaturePermission(
    permissionContext,
    "users",
    "read",
  );
  if (
    !canReadUsers &&
    (context.role === "PAYMENTS" || context.role === "BURSAR")
  ) {
    tasks.push(searchPaymentStudents(searchContext, query));
  }

  tasks.push(searchSubjects(searchContext, query));
  tasks.push(searchAnnouncements(searchContext, query));
  tasks.push(searchEvents(searchContext, query));

  const groups = await Promise.all(tasks);
  return groups.flat();
}

async function searchPeople(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const roleValues = [
    "student",
    "teacher",
    "parent",
    "STUDENT",
    "TEACHER",
    "PARENT",
  ];

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .eq("school_id", context.schoolId)
    .in("role", roleValues)
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
    .order("first_name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    throw error;
  }

  const profileIds = (data || [])
    .map((row: any) => String(row.id || ""))
    .filter(Boolean);
  const enrichment = await loadPeopleEnrichment(context.schoolId, profileIds);

  return (data || []).map((row: any) => {
    const profileId = String(row.id || "");
    const role = String(row.role || "").toLowerCase();
    const extra = enrichment.get(profileId);
    const label = getDisplayName(row);
    const hintParts = [
      formatRoleLabel(role),
      extra?.admissionNumber,
      extra?.className,
      extra?.employeeId,
      row.email,
    ].filter(Boolean);

    return {
      id: `person:${profileId}`,
      kind: "person" as const,
      label,
      hint: hintParts.join(" · ") || "Account",
      href: buildWorkspaceUsersHref(label, profileId),
    };
  });
}

async function searchTeacherStudents(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const scope = await loadTeacherAssignmentScope({
    schoolId: context.schoolId,
    actorProfileId: context.actorProfileId,
  });

  if (scope.allowedClassIds.length === 0) {
    return [];
  }

  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, admission_number, class_id")
    .eq("school_id", context.schoolId)
    .in("class_id", scope.allowedClassIds)
    .limit(120);

  if (studentError) {
    throw studentError;
  }

  const profileIds = Array.from(
    new Set(
      (studentRows || [])
        .map((row: any) => String(row.profile_id || row.id || ""))
        .filter(Boolean),
    ),
  );

  if (profileIds.length === 0) {
    return [];
  }

  const pattern = toWorkspaceSearchPattern(query);
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .eq("school_id", context.schoolId)
    .in("id", profileIds)
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
    .order("first_name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (profileError) {
    throw profileError;
  }

  const classNameById = await loadClassNames(
    context.schoolId,
    Array.from(
      new Set(
        (studentRows || [])
          .map((row: any) => String(row.class_id || ""))
          .filter(Boolean),
      ),
    ),
  );
  const studentMetaByProfileId = new Map(
    (studentRows || []).map((row: any) => [
      String(row.profile_id || row.id || ""),
      row,
    ]),
  );

  return (profiles || []).map((row: any) => {
    const profileId = String(row.id || "");
    const student = studentMetaByProfileId.get(profileId);
    const className =
      classNameById.get(String(student?.class_id || "")) || null;
    const label = getDisplayName(row);

    return {
      id: `person:${profileId}`,
      kind: "person" as const,
      label,
      hint:
        ["Student", student?.admission_number, className]
          .filter(Boolean)
          .join(" · ") || "Student",
      href: buildWorkspaceListHref("/app/teacher/students", label),
    };
  });
}

async function searchParentChildren(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const { data: parentRows, error: parentError } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id, relation_type")
    .eq("school_id", context.schoolId)
    .eq("profile_id", context.actorProfileId)
    .limit(1);

  if (parentError) {
    throw parentError;
  }

  const parentRecord = parentRows?.[0];
  if (!parentRecord) {
    return [];
  }

  const parentRecordId = String(parentRecord.id || "");
  const { data: links, error: linkError } = await supabaseAdmin
    .from("parent_students")
    .select("student_id, relationship")
    .in("parent_id", [parentRecordId, context.actorProfileId]);

  if (linkError) {
    throw linkError;
  }

  const studentIds = Array.from(
    new Set(
      (links || [])
        .map((row: any) => String(row.student_id || ""))
        .filter(Boolean),
    ),
  );

  if (studentIds.length === 0) {
    return [];
  }

  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, admission_number, class_id")
    .eq("school_id", context.schoolId)
    .in("id", studentIds);

  if (studentError) {
    throw studentError;
  }

  const profileIds = Array.from(
    new Set(
      (studentRows || [])
        .map((row: any) => String(row.profile_id || row.id || ""))
        .filter(Boolean),
    ),
  );

  if (profileIds.length === 0) {
    return [];
  }

  const pattern = toWorkspaceSearchPattern(query);
  const { data: profiles, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("school_id", context.schoolId)
    .in("id", profileIds)
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
    .order("first_name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (profileError) {
    throw profileError;
  }

  const classNameById = await loadClassNames(
    context.schoolId,
    Array.from(
      new Set(
        (studentRows || [])
          .map((row: any) => String(row.class_id || ""))
          .filter(Boolean),
      ),
    ),
  );
  const studentMetaByProfileId = new Map(
    (studentRows || []).map((row: any) => [
      String(row.profile_id || row.id || ""),
      row,
    ]),
  );

  return (profiles || []).map((row: any) => {
    const profileId = String(row.id || "");
    const student = studentMetaByProfileId.get(profileId);
    const label = getDisplayName(row);

    return {
      id: `person:${profileId}`,
      kind: "person" as const,
      label,
      hint: [
        "Child",
        student?.admission_number,
        classNameById.get(String(student?.class_id || "")),
      ]
        .filter(Boolean)
        .join(" · "),
      href: buildWorkspaceListHref("/app/parent/attendance", label, {
        studentId: profileId,
      }),
    };
  });
}

async function searchPaymentStudents(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email, role")
    .eq("school_id", context.schoolId)
    .in("role", roleDatabaseValues("STUDENT"))
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern}`,
    )
    .order("first_name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    throw error;
  }

  const profileIds = (data || [])
    .map((row: any) => String(row.id || ""))
    .filter(Boolean);
  const enrichment = await loadPeopleEnrichment(context.schoolId, profileIds);

  return (data || []).map((row: any) => {
    const profileId = String(row.id || "");
    const extra = enrichment.get(profileId);
    const label = getDisplayName(row);

    return {
      id: `payment-student:${profileId}`,
      kind: "person" as const,
      label,
      hint: ["Student account", extra?.admissionNumber, extra?.className]
        .filter(Boolean)
        .join(" · "),
      href: buildWorkspaceListHref("/app/payments/students", label),
    };
  });
}

async function searchClasses(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", context.schoolId)
    .or(`name.ilike.${pattern},grade_level.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    throw error;
  }

  return (data || []).map((row: any) => {
    const classId = String(row.id || "");
    const label = String(row.name || "Class").trim();
    const hint = String(row.grade_level || "").trim() || "Class";

    return {
      id: `class:${classId}`,
      kind: "class" as const,
      label,
      hint,
      href: buildWorkspaceListHref("/app/admin/classes", label),
    };
  });
}

async function searchTeacherClasses(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const scope = await loadTeacherAssignmentScope({
    schoolId: context.schoolId,
    actorProfileId: context.actorProfileId,
  });

  if (scope.allowedClassIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", context.schoolId)
    .in("id", scope.allowedClassIds)
    .order("name", { ascending: true })
    .limit(40);

  if (error) {
    throw error;
  }

  return (data || [])
    .map((row: any) => {
      const classId = String(row.id || "");
      const label = String(row.name || "Class").trim();
      const hint = String(row.grade_level || "").trim() || "Class";

      return {
        id: `class:${classId}`,
        kind: "class" as const,
        label,
        hint,
        href: "/app/teacher/classes",
      };
    })
    .filter((row) =>
      matchesWorkspaceSearchQuery(`${row.label} ${row.hint}`, query),
    )
    .slice(0, RESULT_LIMIT);
}

async function searchSubjects(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("id, name, code")
    .eq("school_id", context.schoolId)
    .or(`name.ilike.${pattern},code.ilike.${pattern}`)
    .order("name", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  return (data || []).map((row: any) => {
    const subjectId = String(row.id || "");
    const label = String(row.name || "Subject").trim();
    const code = String(row.code || "").trim();

    return {
      id: `subject:${subjectId}`,
      kind: "subject" as const,
      label,
      hint: code ? `Code ${code}` : "Subject",
      href: buildWorkspaceListHref("/app/admin/subjects", label),
    };
  });
}

async function searchAnnouncements(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("id, title, target_role")
    .eq("school_id", context.schoolId)
    .ilike("title", pattern)
    .order("created_at", { ascending: false })
    .limit(RESULT_LIMIT);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  const announcementsHref =
    context.role === "STUDENT"
      ? buildWorkspaceListHref("/app/student/announcements", query)
      : context.role === "PARENT"
        ? buildWorkspaceListHref("/app/announcements", query)
        : buildWorkspaceListHref("/app/announcements", query);

  return (data || []).map((row: any) => {
    const announcementId = String(row.id || "");
    const label = String(row.title || "Announcement").trim();
    const audience = String(row.target_role || "").trim();

    return {
      id: `announcement:${announcementId}`,
      kind: "announcement" as const,
      label,
      hint: audience ? `Audience: ${audience}` : "Announcement",
      href: announcementsHref,
    };
  });
}

async function searchEvents(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("id, title, event_date, location")
    .eq("school_id", context.schoolId)
    .ilike("title", pattern)
    .order("event_date", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    if (isMissingRelationError(error)) {
      return [];
    }
    throw error;
  }

  const eventsHref =
    context.role === "STUDENT"
      ? "/app/student"
      : context.role === "PARENT"
        ? "/app/parent"
        : "/app/events";

  return (data || []).map((row: any) => {
    const eventId = String(row.id || "");
    const label = String(row.title || "Event").trim();
    const hint =
      [row.event_date, row.location].filter(Boolean).join(" · ") || "Event";

    return {
      id: `event:${eventId}`,
      kind: "event" as const,
      label,
      hint: String(hint),
      href: buildWorkspaceListHref(eventsHref, label),
    };
  });
}

async function searchStudentAssignments(
  context: SearchContext,
  query: string,
): Promise<WorkspaceSearchResult[]> {
  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, class_id")
    .eq("school_id", context.schoolId)
    .eq("profile_id", context.actorProfileId)
    .limit(1);

  if (studentError) {
    throw studentError;
  }

  const classId = String(studentRows?.[0]?.class_id || "").trim();
  if (!classId) {
    return [];
  }

  const pattern = toWorkspaceSearchPattern(query);
  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, title, due_date")
    .eq("school_id", context.schoolId)
    .eq("class_id", classId)
    .ilike("title", pattern)
    .order("due_date", { ascending: true })
    .limit(RESULT_LIMIT);

  if (error) {
    throw error;
  }

  return (data || []).map((row: any) => {
    const assignmentId = String(row.id || "");
    const label = String(row.title || "Assignment").trim();
    const hint = row.due_date ? `Due ${row.due_date}` : "Assignment";

    return {
      id: `assignment:${assignmentId}`,
      kind: "assignment" as const,
      label,
      hint: String(hint),
      href: buildWorkspaceListHref("/app/student/assignments", label),
    };
  });
}

async function loadPeopleEnrichment(schoolId: string, profileIds: string[]) {
  const enrichment = new Map<
    string,
    {
      admissionNumber?: string | null;
      className?: string | null;
      employeeId?: string | null;
    }
  >();

  if (profileIds.length === 0) {
    return enrichment;
  }

  const [studentsResult, teachersResult, classesResult] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select("profile_id, id, admission_number, class_id")
      .eq("school_id", schoolId)
      .in("profile_id", profileIds),
    supabaseAdmin
      .from("teachers")
      .select("profile_id, id, employee_id")
      .eq("school_id", schoolId)
      .in("profile_id", profileIds),
    supabaseAdmin.from("classes").select("id, name").eq("school_id", schoolId),
  ]);

  if (studentsResult.error && !isMissingRelationError(studentsResult.error)) {
    throw studentsResult.error;
  }
  if (teachersResult.error && !isMissingRelationError(teachersResult.error)) {
    throw teachersResult.error;
  }
  if (classesResult.error && !isMissingRelationError(classesResult.error)) {
    throw classesResult.error;
  }

  const classNameById = new Map(
    (classesResult.data || []).map((row: any) => [
      String(row.id || ""),
      String(row.name || "").trim(),
    ]),
  );

  for (const row of studentsResult.data || []) {
    const profileId = String(row.profile_id || row.id || "");
    if (!profileId) continue;
    enrichment.set(profileId, {
      admissionNumber: row.admission_number || null,
      className: classNameById.get(String(row.class_id || "")) || null,
    });
  }

  for (const row of teachersResult.data || []) {
    const profileId = String(row.profile_id || row.id || "");
    if (!profileId) continue;
    enrichment.set(profileId, {
      employeeId: row.employee_id || null,
      ...enrichment.get(profileId),
    });
  }

  return enrichment;
}

async function loadClassNames(schoolId: string, classIds: string[]) {
  const classNameById = new Map<string, string>();
  if (classIds.length === 0) {
    return classNameById;
  }

  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, name")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    const id = String(row.id || "");
    const name = String(row.name || "").trim();
    if (id && name) {
      classNameById.set(id, name);
    }
  }

  return classNameById;
}

function formatRoleLabel(role: string) {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return "Account";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isMissingRelationError(
  error: { code?: string; message?: string } | null,
) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}
