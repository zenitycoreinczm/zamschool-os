export type RollCallStudentLike = {
  id: string;
  status: string | null;
};

export type RollCallLessonLike = {
  id: string;
  roster: RollCallStudentLike[];
  window?: { canMark: boolean } | null;
};

export type RollCallExceptions = Record<string, Record<string, string>>;

export type RollCallUiState = {
  exceptions: RollCallExceptions;
  expanded: Set<string>;
};

function seedExceptionsForLesson(lesson: RollCallLessonLike) {
  const lessonExceptions: Record<string, string> = {};
  for (const student of lesson.roster) {
    if (student.status && student.status !== "PRESENT") {
      lessonExceptions[student.id] = student.status;
    }
  }
  return lessonExceptions;
}

function shouldExpandByDefault(lesson: RollCallLessonLike) {
  return !lesson.window || lesson.window.canMark;
}

/** Full state for a fresh load (date change / first mount). */
export function buildInitialRollCallState(
  lessons: RollCallLessonLike[],
): RollCallUiState {
  const exceptions: RollCallExceptions = {};
  const expanded = new Set<string>();

  for (const lesson of lessons) {
    exceptions[lesson.id] = seedExceptionsForLesson(lesson);
    if (shouldExpandByDefault(lesson)) expanded.add(lesson.id);
  }

  return { exceptions, expanded };
}

/** Background refresh: never clobber staged (unsaved) teacher edits,
 *  never re-open lessons the teacher collapsed, drop vanished lessons. */
export function mergeRollCallStateOnRefresh(
  prevExceptions: RollCallExceptions,
  prevExpanded: Set<string>,
  lessons: RollCallLessonLike[],
): RollCallUiState {
  const exceptions: RollCallExceptions = {};
  const expanded = new Set<string>();

  for (const lesson of lessons) {
    const previous = prevExceptions[lesson.id];
    exceptions[lesson.id] = previous ?? seedExceptionsForLesson(lesson);

    if (prevExpanded.has(lesson.id)) {
      expanded.add(lesson.id);
    } else if (!(lesson.id in prevExceptions) && shouldExpandByDefault(lesson)) {
      expanded.add(lesson.id);
    }
  }

  return { exceptions, expanded };
}
