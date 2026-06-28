export type TeacherLessonAccessInput = {
  actorId: string;
  lessonTeacherId: string | null;
  classSupervisorId: string | null;
  lessonSchoolId: string | null;
  actorSchoolId: string | null;
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
  return Boolean(
    input.actorId &&
      (input.lessonTeacherId === input.actorId ||
        input.classSupervisorId === input.actorId) &&
      input.lessonSchoolId &&
      input.lessonSchoolId === input.actorSchoolId
  );
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
