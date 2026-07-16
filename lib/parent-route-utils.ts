import { buildParentLinkedStudentProfiles } from "@/lib/live-schema-adapters";
import { supabaseAdmin } from "@/lib/supabase";

export type ParentRecord = {
  id: string;
  relation_type?: string | null;
  profile_id?: string | null;
};

export type LinkedStudentsResult = {
  profileIds: string[];
  relationshipByProfileId: Map<string, string | null>;
  classIdByProfileId: Map<string, string | null>;
  studentNumberByProfileId: Map<string, string | null>;
  studentRowIdByProfileId?: Map<string, string>;
  profileIdByStudentRowId?: Map<string, string>;
};

function emptyLinkedStudents(
  includeRowMappings?: boolean,
): LinkedStudentsResult {
  return {
    profileIds: [],
    relationshipByProfileId: new Map(),
    classIdByProfileId: new Map(),
    studentNumberByProfileId: new Map(),
    ...(includeRowMappings
      ? {
          studentRowIdByProfileId: new Map<string, string>(),
          profileIdByStudentRowId: new Map<string, string>(),
        }
      : {}),
  };
}

function isMissingColumnError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find the")
  );
}

export async function getParentRecord(input: {
  profileId: string;
  schoolId: string | null;
}): Promise<ParentRecord | null> {
  if (!input.profileId || !input.schoolId) return null;

  const selects = ["id, relation_type, profile_id", "id, profile_id", "id"];

  for (let i = 0; i < selects.length; i++) {
    const { data, error } = await supabaseAdmin
      .from("parents")
      .select(selects[i])
      .eq("profile_id", input.profileId)
      .eq("school_id", input.schoolId)
      .maybeSingle();

    if (!error) {
      return data as ParentRecord | null;
    }

    if (!isMissingColumnError(error) || i === selects.length - 1) {
      throw error;
    }
  }

  return null;
}

export async function getLinkedStudents(input: {
  parentRecordId: string;
  parentProfileId: string;
  schoolId: string | null;
  fallbackRelationship?: string | null;
  includeRowMappings?: boolean;
}): Promise<LinkedStudentsResult> {
  if (!input.schoolId || !input.parentRecordId) {
    return emptyLinkedStudents(input.includeRowMappings);
  }

  const parentIdCandidates = Array.from(
    new Set(
      [input.parentRecordId, input.parentProfileId].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );

  const [{ data: parentRows, error: parentError }, linksResult] =
    await Promise.all([
      supabaseAdmin
        .from("parents")
        .select("id, profile_id")
        .eq("school_id", input.schoolId)
        .in("id", [input.parentRecordId]),
      // Prefer schema-accurate parent_id (= parents.id). Also try profile id
      // for older link rows that may have stored profiles.id as parent_id.
      supabaseAdmin
        .from("parent_students")
        .select("parent_id, student_id, relationship")
        .in("parent_id", parentIdCandidates),
    ]);

  if (parentError) throw parentError;

  let links = linksResult.data || [];
  if (linksResult.error) {
    // Some installs only accept parents.id for parent_id FK - retry narrowly.
    const retry = await supabaseAdmin
      .from("parent_students")
      .select("parent_id, student_id, relationship")
      .eq("parent_id", input.parentRecordId);
    if (retry.error) throw retry.error;
    links = retry.data || [];
  }

  const linkStudentKeys = Array.from(
    new Set(links.map((row: any) => row.student_id).filter(Boolean) as string[]),
  );

  let students: any[] = [];
  if (linkStudentKeys.length > 0) {
    // parent_students.student_id may be students.id OR profiles.id depending on
    // how the link was created historically - resolve both.
    const byId = await supabaseAdmin
      .from("students")
      .select("id, profile_id, school_id, class_id, student_number")
      .eq("school_id", input.schoolId)
      .in("id", linkStudentKeys);

    if (byId.error) throw byId.error;
    students = byId.data || [];

    const foundKeys = new Set<string>();
    for (const row of students) {
      if (row.id) foundKeys.add(row.id);
      if (row.profile_id) foundKeys.add(row.profile_id);
    }
    const missingKeys = linkStudentKeys.filter((key) => !foundKeys.has(key));

    if (missingKeys.length > 0) {
      const byProfile = await supabaseAdmin
        .from("students")
        .select("id, profile_id, school_id, class_id, student_number")
        .eq("school_id", input.schoolId)
        .in("profile_id", missingKeys);

      if (byProfile.error) throw byProfile.error;
      const existingIds = new Set(students.map((row) => row.id));
      for (const row of byProfile.data || []) {
        if (!existingIds.has(row.id)) {
          students.push(row);
          existingIds.add(row.id);
        }
      }
    }
  }

  // Normalize links so buildParentLinkedStudentProfiles can match by students.id
  const studentById = new Map(students.map((row) => [row.id, row]));
  const studentByProfileId = new Map(
    students
      .filter((row) => row.profile_id)
      .map((row) => [row.profile_id as string, row]),
  );
  const normalizedLinks = links.map((link: any) => {
    const student =
      studentById.get(link.student_id) ||
      studentByProfileId.get(link.student_id) ||
      null;
    return student
      ? { ...link, student_id: student.id }
      : link;
  });

  const mapped = buildParentLinkedStudentProfiles({
    actorProfileId: input.parentProfileId,
    actorSchoolId: input.schoolId,
    parents: parentRows || [],
    students,
    links: normalizedLinks,
  });

  const classIdByProfileId = new Map<string, string | null>();
  const studentNumberByProfileId = new Map<string, string | null>();

  for (const student of students) {
    const profileId = student.profile_id || student.id;
    if (!mapped.relationshipByProfileId.has(profileId)) continue;
    classIdByProfileId.set(profileId, student.class_id || null);
    studentNumberByProfileId.set(profileId, student.student_number || null);
  }

  if (mapped.profileIds.length > 0) {
    return {
      profileIds: mapped.profileIds,
      relationshipByProfileId: mapped.relationshipByProfileId,
      classIdByProfileId,
      studentNumberByProfileId,
      ...(input.includeRowMappings
        ? {
            studentRowIdByProfileId: mapped.studentRowIdByProfileId,
            profileIdByStudentRowId: mapped.profileIdByStudentRowId,
          }
        : {}),
    };
  }

  // Historical fallback used profiles.parent_id, but that column does not exist
  // on public.profiles (baseline schema). Returning empty avoids a 500.
  return emptyLinkedStudents(input.includeRowMappings);
}

export async function getClassesById(schoolId: string | null, classIds: string[]) {
  if (!schoolId || classIds.length === 0) {
    return new Map<string, any>();
  }

  const legacy = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!legacy.error) {
    return new Map((legacy.data || []).map((row: any) => [row.id, row]));
  }

  const modern = await supabaseAdmin
    .from("classes")
    .select("id, name, grades(name, level)")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (modern.error) throw modern.error;

  return new Map((modern.data || []).map((row: any) => [row.id, row]));
}

export function buildClassLabel(classRow: any) {
  if (!classRow) return "Unassigned class";

  const gradeName =
    typeof classRow?.grades?.name === "string"
      ? classRow.grades.name.trim()
      : buildGradeLevelLabel(classRow?.grade_level);
  const className = typeof classRow?.name === "string" ? classRow.name.trim() : "";

  return [gradeName, className].filter(Boolean).join(" - ") || className || "Class";
}

export function buildGradeLevelLabel(value: string | number | null | undefined) {
  const level = String(value || "").trim();
  return level ? `Grade ${level}` : "";
}

export function buildDisplayName(row: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return (
    [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
    row.email ||
    "Student"
  );
}
