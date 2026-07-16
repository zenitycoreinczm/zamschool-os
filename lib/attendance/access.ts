export type TeacherLessonAccessInput = {
  actorId: string;
  lessonTeacherId: string | null;
  classSupervisorId: string | null;
  lessonSchoolId: string | null;
  actorSchoolId: string | null;
  /**
   * Class id for the lesson. When set with `allowedClassIds`, any teacher who
   * teaches that class (subject assignment / timetable / class teacher) gets
   * the same lesson access as the class teacher - not only the supervisor.
   */
  classId?: string | null;
  allowedClassIds?: string[] | null;
};

export type ParentStudentLink = {
  parentId: string | null;
  student:
    | {
        id: string;
        schoolId: string | null;
      }
    | null;
};

export type StudentRosterRow = {
  id: string;
  classId: string | null;
  className?: string | null;
};

export function canTeacherAccessLesson(input: TeacherLessonAccessInput) {
  if (
    !input.actorId ||
    !input.lessonSchoolId ||
    input.lessonSchoolId !== input.actorSchoolId
  ) {
    return false;
  }

  // Own lesson period or class teacher (homeroom supervisor).
  if (
    input.lessonTeacherId === input.actorId ||
    input.classSupervisorId === input.actorId
  ) {
    return true;
  }

  // Subject / assigned teachers for the class: full class student access.
  const classId = String(input.classId || "").trim();
  if (
    classId &&
    Array.isArray(input.allowedClassIds) &&
    input.allowedClassIds.includes(classId)
  ) {
    return true;
  }

  return false;
}

export function buildParentStudentScope(input: {
  actorId: string;
  actorSchoolId: string | null;
  linkedStudents: ParentStudentLink[];
}) {
  if (!input.actorId || !input.actorSchoolId) {
    return [];
  }

  return input.linkedStudents.flatMap((student) =>
    student.parentId === input.actorId &&
    student.student?.id &&
    student.student.schoolId === input.actorSchoolId
      ? [student.student.id]
      : []
  );
}

export function buildStudentRosterScope(input: {
  classId: string | null;
  students: StudentRosterRow[];
}) {
  if (!input.classId) {
    return [];
  }

  return input.students.flatMap((student) =>
    student.id && student.classId === input.classId ? [student.id] : []
  );
}

export function buildRollcallCompletionState(input: {
  rosterCount: number;
  selectedStatuses: number;
}) {
  if (input.rosterCount <= 0) {
    return "empty";
  }

  if (input.selectedStatuses < input.rosterCount) {
    return "incomplete";
  }

  return "complete";
}
