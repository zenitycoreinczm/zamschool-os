import { supabaseAdmin } from "@/lib/supabase";
import { normalizeRole } from "@/lib/roles";

type RosterStudentRow = {
  id: string;
  profile_id?: string | null;
};

/**
 * Resolve parent profile IDs for each students-row id.
 *
 * Historical link shapes we must support:
 * - parent_students.student_id → students.id OR profiles.id
 * - parent_students.parent_id  → parents.id OR profiles.id (PARENT role)
 */
export async function loadParentProfileIdsByStudentRowId(input: {
  schoolId: string;
  rosterRows: RosterStudentRow[];
}): Promise<Map<string, string[]>> {
  const studentRowIds = input.rosterRows.map((row) => row.id).filter(Boolean);
  if (studentRowIds.length === 0) {
    return new Map();
  }

  const profileIds = Array.from(
    new Set(
      input.rosterRows
        .map((row) => row.profile_id)
        .filter(Boolean) as string[],
    ),
  );
  const linkStudentKeys = Array.from(new Set([...studentRowIds, ...profileIds]));

  const linkQuery = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .in("student_id", linkStudentKeys);

  if (linkQuery.error) {
    throw linkQuery.error;
  }

  const links = (linkQuery.data || []) as Array<{
    parent_id: string;
    student_id: string;
  }>;

  const parentIds = Array.from(
    new Set(links.map((row) => row.parent_id).filter(Boolean)),
  );
  if (parentIds.length === 0) {
    return new Map();
  }

  // Shape A: parent_id is parents.id → resolve parents.profile_id
  // Shape B: parent_id is already a parent profile id (any case of PARENT/GUARDIAN)
  const [parentRowsResult, directParentProfilesResult] = await Promise.all([
    supabaseAdmin
      .from("parents")
      .select("id, profile_id, school_id")
      .eq("school_id", input.schoolId)
      .in("id", parentIds),
    supabaseAdmin
      .from("profiles")
      .select("id, school_id, role")
      .eq("school_id", input.schoolId)
      .in("id", parentIds),
  ]);

  if (parentRowsResult.error) {
    throw parentRowsResult.error;
  }
  if (directParentProfilesResult.error) {
    throw directParentProfilesResult.error;
  }

  const parentProfileIdByParentId = new Map<string, string>();
  for (const row of parentRowsResult.data || []) {
    if (row.id && row.profile_id) {
      parentProfileIdByParentId.set(String(row.id), String(row.profile_id));
    }
  }
  for (const row of directParentProfilesResult.data || []) {
    if (!row?.id) continue;
    const role = normalizeRole(row.role);
    // Accept parent / guardian; if role missing but id was linked as parent_id, still accept.
    if (!role || role === "PARENT") {
      parentProfileIdByParentId.set(String(row.id), String(row.id));
    }
  }

  // Fallback: parents table without school filter (mis-scoped rows) still linked.
  const unresolved = parentIds.filter(
    (id) => !parentProfileIdByParentId.has(String(id)),
  );
  if (unresolved.length > 0) {
    const { data: looseParents, error: looseError } = await supabaseAdmin
      .from("parents")
      .select("id, profile_id, school_id")
      .in("id", unresolved);
    if (!looseError) {
      for (const row of looseParents || []) {
        if (row.id && row.profile_id) {
          parentProfileIdByParentId.set(String(row.id), String(row.profile_id));
        }
      }
    }

    // Last resort: treat remaining parent_ids as profile ids if a profile exists.
    const stillMissing = unresolved.filter(
      (id) => !parentProfileIdByParentId.has(String(id)),
    );
    if (stillMissing.length > 0) {
      const { data: looseProfiles, error: looseProfilesError } =
        await supabaseAdmin
          .from("profiles")
          .select("id, role")
          .in("id", stillMissing);
      if (!looseProfilesError) {
        for (const row of looseProfiles || []) {
          if (!row?.id) continue;
          const role = normalizeRole(row.role);
          if (!role || role === "PARENT") {
            parentProfileIdByParentId.set(String(row.id), String(row.id));
          }
        }
      }
    }
  }

  const studentRowIdByLinkKey = new Map<string, string>();
  for (const row of input.rosterRows) {
    studentRowIdByLinkKey.set(String(row.id), String(row.id));
    if (row.profile_id) {
      studentRowIdByLinkKey.set(String(row.profile_id), String(row.id));
    }
  }

  const recipientsByStudentRowId = new Map<string, Set<string>>();

  for (const link of links) {
    const studentRowId = studentRowIdByLinkKey.get(String(link.student_id));
    const parentProfileId = parentProfileIdByParentId.get(String(link.parent_id));
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
