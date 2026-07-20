import { supabaseAdmin } from "@/lib/supabase";
import { normalizeRole } from "@/lib/roles";

type RosterStudentRow = {
  id: string;
  profile_id?: string | null;
};

/**
 * Resolve parent profile IDs for each students-row id.
 *
 * Supports every historical link shape used by admin + mobile:
 * - parent_students.student_id → students.id OR student profiles.id
 * - parent_students.parent_id  → parents.id OR parent profiles.id OR auth uid
 *
 * Returns Map<studentsRowId, parentProfileId[]>
 */
export async function loadParentProfileIdsByStudentRowId(input: {
  schoolId: string;
  rosterRows: RosterStudentRow[];
}): Promise<Map<string, string[]>> {
  const empty = new Map<string, string[]>();
  const studentRowIds = input.rosterRows.map((row) => String(row.id || "").trim()).filter(Boolean);
  if (studentRowIds.length === 0) return empty;

  const studentProfileIds = Array.from(
    new Set(
      input.rosterRows
        .map((row) => String(row.profile_id || "").trim())
        .filter(Boolean),
    ),
  );
  const linkStudentKeys = Array.from(new Set([...studentRowIds, ...studentProfileIds]));

  const linkQuery = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .eq("school_id", input.schoolId)
    .in("student_id", linkStudentKeys);

  if (linkQuery.error) {
    throw linkQuery.error;
  }

  const links = (linkQuery.data || []) as Array<{
    parent_id: string;
    student_id: string;
  }>;
  if (links.length === 0) {
    return empty;
  }

  const parentLinkIds = Array.from(
    new Set(links.map((row) => String(row.parent_id || "").trim()).filter(Boolean)),
  );

  // 1) parents.id -> parents.profile_id, restricted to the attendance school.
  const parentsInSchool = await supabaseAdmin
    .from("parents")
    .select("id, profile_id, school_id")
    .eq("school_id", input.schoolId)
    .in("id", parentLinkIds);

  // 2) parent_id already a profile id (or auth uid on profile)
  const [profilesById, profilesByAuth] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, role, school_id")
      .eq("school_id", input.schoolId)
      .in("id", parentLinkIds),
    supabaseAdmin
      .from("profiles")
      .select("id, auth_user_id, role, school_id")
      .eq("school_id", input.schoolId)
      .in("auth_user_id", parentLinkIds),
  ]);

  // Map any parent_students.parent_id value → canonical parent profile id
  const parentProfileByLinkId = new Map<string, string>();

  for (const row of parentsInSchool.data || []) {
    if (row?.id && row?.profile_id) {
      parentProfileByLinkId.set(String(row.id), String(row.profile_id));
    }
  }
  for (const row of profilesById.data || []) {
    if (!row?.id) continue;
    const role = normalizeRole(row.role);
    // Prefer parent/guardian; if role is missing/unknown still accept — the link
    // table already asserts this id is a parent of the student.
    if (!role || role === "PARENT") {
      parentProfileByLinkId.set(String(row.id), String(row.id));
    }
  }

  for (const row of profilesByAuth.data || []) {
    if (!row?.id || !row?.auth_user_id) continue;
    const role = normalizeRole(row.role);
    if (!role || role === "PARENT") {
      parentProfileByLinkId.set(String(row.auth_user_id), String(row.id));
      parentProfileByLinkId.set(String(row.id), String(row.id));
    }
  }

  // 3) parents.profile_id matches link parent_id (reverse lookup)
  const unresolved = parentLinkIds.filter((id) => !parentProfileByLinkId.has(id));
  if (unresolved.length > 0) {
    const { data: byProfileField } = await supabaseAdmin
      .from("parents")
      .select("id, profile_id")
      .eq("school_id", input.schoolId)
      .in("profile_id", unresolved);
    for (const row of byProfileField || []) {
      if (row?.profile_id) {
        parentProfileByLinkId.set(String(row.profile_id), String(row.profile_id));
        if (row.id) {
          parentProfileByLinkId.set(String(row.id), String(row.profile_id));
        }
      }
    }
  }

  // Map any student key used in parent_students → students-row id from roster
  const studentRowIdByLinkKey = new Map<string, string>();
  for (const row of input.rosterRows) {
    const rowId = String(row.id || "").trim();
    if (!rowId) continue;
    studentRowIdByLinkKey.set(rowId, rowId);
    const profileId = String(row.profile_id || "").trim();
    if (profileId) {
      studentRowIdByLinkKey.set(profileId, rowId);
    }
  }

  const recipientsByStudentRowId = new Map<string, Set<string>>();

  for (const link of links) {
    const studentRowId = studentRowIdByLinkKey.get(String(link.student_id || "").trim());
    const parentProfileId = parentProfileByLinkId.get(String(link.parent_id || "").trim());
    if (!studentRowId || !parentProfileId) continue;

    const existing =
      recipientsByStudentRowId.get(studentRowId) || new Set<string>();
    existing.add(parentProfileId);
    recipientsByStudentRowId.set(studentRowId, existing);
  }

  return new Map(
    Array.from(recipientsByStudentRowId.entries()).map(
      ([studentRowId, parentSet]) => [
        studentRowId,
        Array.from(parentSet).slice(0, 2),
      ],
    ),
  );
}
