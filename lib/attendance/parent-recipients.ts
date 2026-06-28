import { supabaseAdmin } from "@/lib/supabase";

type RosterStudentRow = {
  id: string;
  profile_id?: string | null;
};

/**
 * Resolve parent profile IDs for each students-row id.
 * parent_students.student_id may store either students.id or profiles.id depending on link history.
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
    new Set(input.rosterRows.map((row) => row.profile_id).filter(Boolean) as string[])
  );
  const linkStudentKeys = Array.from(new Set([...studentRowIds, ...profileIds]));

  let links: Array<{ parent_id: string; student_id: string }> = [];

  const linkQuery = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id")
    .in("student_id", linkStudentKeys);

  if (linkQuery.error) {
    throw linkQuery.error;
  }

  links = (linkQuery.data || []) as Array<{ parent_id: string; student_id: string }>;

  const parentIds = Array.from(new Set(links.map((row) => row.parent_id).filter(Boolean)));
  if (parentIds.length === 0) {
    return new Map();
  }

  const { data: parentRows, error: parentError } = await supabaseAdmin
    .from("parents")
    .select("id, profile_id, school_id")
    .eq("school_id", input.schoolId)
    .in("id", parentIds);

  if (parentError) {
    throw parentError;
  }

  const parentProfileIdByParentId = new Map<string, string>();
  for (const row of parentRows || []) {
    if (row.id && row.profile_id) {
      parentProfileIdByParentId.set(row.id, row.profile_id);
    }
  }

  const profileIdByStudentRowId = new Map<string, string>();
  for (const row of input.rosterRows) {
    if (row.id && row.profile_id) {
      profileIdByStudentRowId.set(row.id, row.profile_id);
    }
  }

  const studentRowIdByLinkKey = new Map<string, string>();
  for (const row of input.rosterRows) {
    studentRowIdByLinkKey.set(row.id, row.id);
    if (row.profile_id) {
      studentRowIdByLinkKey.set(row.profile_id, row.id);
    }
  }

  const recipientsByStudentRowId = new Map<string, Set<string>>();

  for (const link of links) {
    const studentRowId = studentRowIdByLinkKey.get(link.student_id);
    const parentProfileId = parentProfileIdByParentId.get(link.parent_id);
    if (!studentRowId || !parentProfileId) continue;

    const existing = recipientsByStudentRowId.get(studentRowId) || new Set<string>();
    existing.add(parentProfileId);
    recipientsByStudentRowId.set(studentRowId, existing);
  }

  return new Map(
    Array.from(recipientsByStudentRowId.entries()).map(([studentRowId, parentSet]) => [
      studentRowId,
      Array.from(parentSet),
    ])
  );
}
