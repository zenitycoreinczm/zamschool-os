type MaybeString = string | null | undefined;

type TeacherRow = {
  id: string;
  profile_id?: string | null;
};

type ProfileRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  name?: string | null;
};

type StudentRow = {
  id: string;
  profile_id?: string | null;
  school_id?: string | null;
};

type ParentRow = {
  id: string;
  profile_id?: string | null;
};

type ParentStudentLinkRow = {
  parent_id?: string | null;
  student_id?: string | null;
  relationship?: string | null;
};

type LessonRowInput = {
  id: string;
  title?: string | null;
  class_id?: string | null;
  subject_id?: string | null;
  teacher_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

function getDisplayName(profile: ProfileRow | undefined): string {
  return (
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    profile?.name ||
    profile?.email ||
    "User"
  );
}

/**
 * Normalize term names stored as bare numbers ("2") into "Term 2".
 * Leaves "Term 2" / "Semester 1" etc. alone (title-cased prefix).
 */
export function normalizeTermLabel(termName?: MaybeString): string {
  const raw = String(termName || "").trim();
  if (!raw) return "";

  if (/^\d{1,2}$/.test(raw)) {
    return `Term ${raw}`;
  }

  const prefixed = raw.match(/^(term|semester|sem\.?|session)\s*(.+)$/i);
  if (prefixed) {
    const kind = prefixed[1].toLowerCase();
    const rest = String(prefixed[2] || "").trim();
    const label =
      kind.startsWith("sem") && kind !== "semester"
        ? "Sem"
        : kind.startsWith("session")
          ? "Session"
          : kind.startsWith("semester")
            ? "Semester"
            : "Term";
    return rest ? `${label} ${rest}` : label;
  }

  return raw;
}

/**
 * Split a stored/composed academic label into year + small term parts.
 * Accepts modern "2026 Term 2" and legacy "2026 - 2" / "2026 - Term 2".
 */
export function splitAcademicContextLabel(label?: MaybeString): {
  year: string;
  term: string | null;
} {
  const raw = String(label || "").trim();
  if (!raw || /^academic context$/i.test(raw)) {
    return { year: raw || "Academic Context", term: null };
  }

  const modern = raw.match(
    /^(.+?)\s+((?:Term|Semester|Sem\.?|Session)\s+.+)$/i,
  );
  if (modern) {
    return {
      year: modern[1].trim(),
      term: normalizeTermLabel(modern[2]),
    };
  }

  const legacy = raw.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (legacy) {
    return {
      year: legacy[1].trim(),
      term: normalizeTermLabel(legacy[2]),
    };
  }

  // Bare term number alone is rare; treat as year-less term.
  if (/^\d{1,2}$/.test(raw) || /^(term|semester)\b/i.test(raw)) {
    return { year: "", term: normalizeTermLabel(raw) };
  }

  return { year: raw, term: null };
}

/** Plain-text academic context for strings (API, toasts, descriptions). */
export function buildAcademicContextLabel(
  yearName?: MaybeString,
  termName?: MaybeString,
) {
  const year = String(yearName || "").trim();
  const term = normalizeTermLabel(termName);
  if (year && term) return `${year} ${term}`;
  if (year) return year;
  if (term) return term;
  return "Academic Context";
}

export function buildTeacherDirectory(teachers: TeacherRow[], profiles: ProfileRow[]) {
  const profileById = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
  const options = teachers.map((teacher) => ({
    id: teacher.id,
    label: getDisplayName(profileById[teacher.profile_id || ""]),
  }));
  const nameByTeacherId = Object.fromEntries(options.map((option) => [option.id, option.label]));
  return { options, nameByTeacherId };
}

export function buildTeacherActorIds(input: {
  actorProfileId: string;
  teachers: TeacherRow[];
}) {
  const actorIds = new Set<string>();
  if (input.actorProfileId) {
    actorIds.add(input.actorProfileId);
  }

  for (const teacher of input.teachers) {
    if (teacher.profile_id === input.actorProfileId && teacher.id) {
      actorIds.add(teacher.id);
    }
  }

  return Array.from(actorIds);
}

/**
 * Prefer public.teachers.id for FKs / triggers on assignments.teacher_id,
 * lessons.teacher_id, etc. actorTeacherIds also includes profile_id for legacy
 * joins — never use [0] alone when writing those FKs.
 */
export function resolveTeachersTableId(input: {
  actorProfileId: string;
  actorTeacherIds: string[];
  teachers?: Array<{ id: string; profile_id?: string | null }>;
}): string | null {
  const fromRows = (input.teachers || []).find(
    (row) =>
      row.id &&
      (row.profile_id === input.actorProfileId ||
        input.actorTeacherIds.includes(row.id)),
  )?.id;
  if (fromRows) return String(fromRows);

  const profileId = String(input.actorProfileId || "").trim();
  const nonProfile = input.actorTeacherIds.find(
    (id) => id && id !== profileId,
  );
  return nonProfile ? String(nonProfile) : null;
}

export function buildParentLinkedStudentProfiles(input: {
  actorProfileId: string;
  actorSchoolId: string | null;
  parents: ParentRow[];
  students: StudentRow[];
  links: ParentStudentLinkRow[];
}) {
  if (!input.actorProfileId || !input.actorSchoolId) {
    return {
      profileIds: [] as string[],
      relationshipByProfileId: new Map<string, string | null>(),
      studentRowIdByProfileId: new Map<string, string>(),
      profileIdByStudentRowId: new Map<string, string>(),
    };
  }

  const allowedParentIds = new Set<string>([input.actorProfileId]);
  for (const parent of input.parents) {
    if (parent.profile_id === input.actorProfileId && parent.id) {
      allowedParentIds.add(parent.id);
    }
  }

  const studentsByRowId = new Map(
    input.students.map((student) => [student.id, student])
  );
  const studentsByProfileId = new Map(
    input.students
      .filter((student) => student.profile_id)
      .map((student) => [String(student.profile_id), student]),
  );
  const relationshipByProfileId = new Map<string, string | null>();
  const studentRowIdByProfileId = new Map<string, string>();
  const profileIdByStudentRowId = new Map<string, string>();

  for (const link of input.links) {
    if (!link.parent_id || !allowedParentIds.has(link.parent_id) || !link.student_id) {
      continue;
    }

    // Links may store students.id or profiles.id in student_id.
    const student =
      studentsByRowId.get(link.student_id) ||
      studentsByProfileId.get(link.student_id);
    const profileId = student?.profile_id || student?.id || null;
    if (!profileId || student?.school_id !== input.actorSchoolId) {
      continue;
    }

    relationshipByProfileId.set(profileId, link.relationship || null);
    studentRowIdByProfileId.set(profileId, student.id);
    profileIdByStudentRowId.set(student.id, profileId);
  }

  return {
    profileIds: Array.from(relationshipByProfileId.keys()),
    relationshipByProfileId,
    studentRowIdByProfileId,
    profileIdByStudentRowId,
  };
}

export function normalizeTimeValue(value?: MaybeString) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.slice(0, 5);
}

export function buildAttendanceSessionKey(input: {
  classId?: MaybeString;
  studentId?: MaybeString;
  sessionName?: MaybeString;
  sessionTime?: MaybeString;
}) {
  return [
    String(input.classId || "").trim(),
    String(input.studentId || "").trim(),
    String(input.sessionName || "").trim().toLowerCase(),
    normalizeTimeValue(input.sessionTime),
  ].join(":");
}

function formatTimeRange(startTime?: MaybeString, endTime?: MaybeString) {
  const start = String(startTime || "").slice(0, 5);
  const end = String(endTime || "").slice(0, 5);
  if (start && end) return `${start} - ${end}`;
  return start || end || "-";
}

export function mapLessonRows(
  lessons: LessonRowInput[],
  classMap: Record<string, string>,
  subjectMap: Record<string, string>,
  teacherMap: Record<string, string>
) {
  return lessons.map((lesson) => ({
    ...lesson,
    class: classMap[lesson.class_id || ""] || "-",
    subject: subjectMap[lesson.subject_id || ""] || "-",
    teacher: teacherMap[lesson.teacher_id || ""] || "-",
    time: formatTimeRange(lesson.start_time, lesson.end_time),
  }));
}
