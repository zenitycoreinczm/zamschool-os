export type TimetableLesson = {
  id: string;
  title: string | null;
  subject_id: string;
  class_id: string;
  teacher_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type TimetableMaps = {
  classMap: Record<string, string>;
  subjectMap: Record<string, string>;
  teacherMap: Record<string, string>;
};

type TimetableArgs = TimetableMaps & {
  lessons: TimetableLesson[];
  selectedClass?: string;
  selectedTeacher?: string;
};

type DayDef = {
  key: number;
  label: string;
  fullLabel: string;
};

const DAYS: DayDef[] = [
  { key: 1, label: "Mon", fullLabel: "Monday" },
  { key: 2, label: "Tue", fullLabel: "Tuesday" },
  { key: 3, label: "Wed", fullLabel: "Wednesday" },
  { key: 4, label: "Thu", fullLabel: "Thursday" },
  { key: 5, label: "Fri", fullLabel: "Friday" },
];

const SLOT_MINUTES = 30;
const DEFAULT_TIMETABLE_START = "07:00";
const DEFAULT_TIMETABLE_END = "16:00";
const TONES = ["sky", "emerald", "amber", "violet", "rose"] as const;

export type LessonCardView = {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  className: string;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  timeRange: string;
  durationMinutes: number;
  slotSpan: number;
  tone: (typeof TONES)[number];
};

type TimetableSlot = {
  label: string;
  lessons: LessonCardView[];
};

export type TimetableBoard = {
  totalLessons: number;
  busiestDayLabel: string;
  days: Array<{
    key: number;
    label: string;
    fullLabel: string;
    totalLessons: number;
    slots: TimetableSlot[];
  }>;
};

export function buildTimetableBoard({
  lessons,
  selectedClass = "all",
  selectedTeacher = "all",
  classMap,
  subjectMap,
  teacherMap,
}: TimetableArgs): TimetableBoard {
  const filtered = filterLessons(lessons, selectedClass, selectedTeacher);
  const visibleLessonCards = filtered.map((lesson, index) =>
    toLessonCard(lesson, index, classMap, subjectMap, teacherMap)
  );

  const slotWindow = buildSlotWindow(filtered);
  const slots = buildTimeSlots(slotWindow.start, slotWindow.end, SLOT_MINUTES);
  const days = DAYS.map((day) => {
    const dayLessons = visibleLessonCards.filter((lesson) => lesson.dayOfWeek === day.key);
    const daySlots = slots.map((slot) => ({
      label: slot,
      lessons: dayLessons.filter((lesson) => anchorsInSlot(slot, lesson.startsAt)),
    }));

    return {
      key: day.key,
      label: day.label,
      fullLabel: day.fullLabel,
      totalLessons: dayLessons.length,
      slots: daySlots,
    };
  });

  const busiestDay = [...days].sort((left, right) => right.totalLessons - left.totalLessons)[0];

  return {
    totalLessons: filtered.length,
    busiestDayLabel: busiestDay?.totalLessons ? busiestDay.fullLabel : "No lessons",
    days,
  };
}

export function buildMobileDaySections({
  lessons,
  selectedClass = "all",
  selectedTeacher = "all",
  classMap,
  subjectMap,
  teacherMap,
}: TimetableArgs) {
  const filtered = filterLessons(lessons, selectedClass, selectedTeacher);
  return DAYS.map((day) => {
    const dayLessons = filtered
      .filter((lesson) => getLessonDayKey(lesson) === day.key)
      .sort((left, right) => toMinutes(left.start_time) - toMinutes(right.start_time))
      .map((lesson, index) => toLessonCard(lesson, index, classMap, subjectMap, teacherMap));

    return {
      key: day.key,
      label: day.fullLabel,
      lessons: dayLessons,
    };
  }).filter((section) => section.lessons.length > 0);
}

export function getLessonActionItems(_lesson: { id: string }) {
  return [
    {
      key: "view",
      label: "View lesson",
      tone: "neutral",
    },
    {
      key: "delete",
      label: "Delete lesson",
      tone: "danger",
    },
  ] as const;
}

export function buildTimeSlots(start: string, end: string, stepMinutes: number) {
  const out: string[] = [];
  let cur = toMinutes(start);
  const endMin = toMinutes(end);
  while (cur < endMin) {
    out.push(toHHMM(cur));
    cur += stepMinutes;
  }
  return out;
}

export function toMinutes(hhmm: string) {
  const [h, m] = normalizeClockTime(hhmm).split(":").map(Number);
  return h * 60 + m;
}

function filterLessons(
  lessons: TimetableLesson[],
  selectedClass = "all",
  selectedTeacher = "all",
) {
  return lessons.filter((lesson) => {
    if (selectedClass !== "all" && lesson.class_id !== selectedClass) {
      return false;
    }
    if (selectedTeacher !== "all" && lesson.teacher_id !== selectedTeacher) {
      return false;
    }
    return true;
  });
}

function buildSlotWindow(lessons: TimetableLesson[]) {
  if (lessons.length === 0) {
    return {
      start: DEFAULT_TIMETABLE_START,
      end: DEFAULT_TIMETABLE_END,
    };
  }

  // Fit the board to actual lessons — do not force a 07:00–16:00 shell of
  // empty rows when the day only has a few periods.
  let earliestMinutes = Infinity;
  let latestMinutes = -Infinity;

  for (const lesson of lessons) {
    earliestMinutes = Math.min(
      earliestMinutes,
      floorToSlotMinutes(toMinutes(lesson.start_time)),
    );
    latestMinutes = Math.max(
      latestMinutes,
      ceilToSlotMinutes(toMinutes(lesson.end_time)),
    );
  }

  // One slot of breathing room so cards are not flush to the edge.
  earliestMinutes = Math.max(0, earliestMinutes - SLOT_MINUTES);
  latestMinutes = Math.min(24 * 60, latestMinutes + SLOT_MINUTES);

  if (!Number.isFinite(earliestMinutes) || !Number.isFinite(latestMinutes)) {
    return {
      start: DEFAULT_TIMETABLE_START,
      end: DEFAULT_TIMETABLE_END,
    };
  }

  return {
    start: toHHMM(earliestMinutes),
    end: toHHMM(Math.max(latestMinutes, earliestMinutes + SLOT_MINUTES)),
  };
}

function toLessonCard(
  lesson: TimetableLesson,
  index: number,
  classMap: Record<string, string>,
  subjectMap: Record<string, string>,
  teacherMap: Record<string, string>
): LessonCardView {
  const startsAt = normalizeClockTime(lesson.start_time);
  const endsAt = normalizeClockTime(lesson.end_time);
  return {
    id: lesson.id,
    title: lesson.title?.trim() || subjectMap[lesson.subject_id] || "Lesson",
    subject: subjectMap[lesson.subject_id] || "Subject",
    teacher: teacherMap[lesson.teacher_id] || "Teacher",
    className: classMap[lesson.class_id] || "Class",
    dayOfWeek: getLessonDayKey(lesson),
    startsAt,
    endsAt,
    timeRange: `${startsAt} - ${endsAt}`,
    durationMinutes: toMinutes(lesson.end_time) - toMinutes(lesson.start_time),
    slotSpan: Math.max(1, Math.ceil((toMinutes(lesson.end_time) - toMinutes(lesson.start_time)) / SLOT_MINUTES)),
    tone: TONES[index % TONES.length],
  };
}

function getLessonDayKey(lesson: Pick<TimetableLesson, "day_of_week">) {
  const numeric = Number(lesson.day_of_week);
  return Number.isFinite(numeric) ? numeric : -1;
}

function toHHMM(mins: number) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function normalizeClockTime(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) {
    return String(value || "").trim();
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function anchorsInSlot(slotStart: string, lessonStart: string) {
  const s = toMinutes(slotStart);
  const e = s + SLOT_MINUTES;
  const ls = toMinutes(lessonStart);
  return ls >= s && ls < e;
}

function floorToSlotMinutes(totalMinutes: number) {
  return Math.floor(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES;
}

function ceilToSlotMinutes(totalMinutes: number) {
  return Math.ceil(totalMinutes / SLOT_MINUTES) * SLOT_MINUTES;
}
