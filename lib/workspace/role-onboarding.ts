/**
 * Role-accurate onboarding / “next steps” checklists.
 *
 * Head Teacher no longer owns class enrolment or teacher desk work —
 * registrar handles people; teachers own roll call & results.
 */

export type RoleOnboardingId =
  | "principal"
  | "registrar"
  | "teacher"
  | "student"
  | "parent";

export type RoleOnboardingStep = {
  id: string;
  label: string;
  hint: string;
  href: string;
  /** When true, step is complete */
  done: boolean;
  /** Count toward core progress (default true) */
  core?: boolean;
};

export type RoleOnboardingGuide = {
  role: RoleOnboardingId;
  eyebrow: string;
  title: string;
  description: string;
  steps: RoleOnboardingStep[];
  storageKey: string;
};

export function buildPrincipalGuide(input: {
  staffInvitesPending?: number;
  hasAnnouncement?: boolean;
  hasEvent?: boolean;
  lateRollCalls?: number;
  systemDefaultsReady?: boolean;
}): RoleOnboardingGuide {
  const steps: RoleOnboardingStep[] = [
    {
      id: "defaults",
      label: "Apply school defaults",
      hint: input.systemDefaultsReady
        ? "Departments & permission groups ready"
        : "One tap: departments, groups, settings",
      href: "/app/principal",
      done: Boolean(input.systemDefaultsReady),
    },
    {
      id: "invite-registrar",
      label: "Invite Registrar (or office staff)",
      hint: "Registrar enrols learners & teachers — not the Head Teacher desk",
      href: "/app/principal/staff",
      done: false, // completed when dismissed after staff exist; see live metrics below
    },
    {
      id: "announce",
      label: "Send first announcement",
      hint: input.hasAnnouncement
        ? "Families & staff can see school notices"
        : "Welcome parents and staff to the term",
      href: "/app/announcements",
      done: Boolean(input.hasAnnouncement),
    },
    {
      id: "event",
      label: "Create a school event",
      hint: input.hasEvent
        ? "Calendar is live"
        : "Assembly, PTA, sports day — on the school calendar",
      href: "/app/events",
      done: Boolean(input.hasEvent),
    },
    {
      id: "late-roll",
      label: "Watch late roll-call alerts",
      hint:
        (input.lateRollCalls ?? 0) > 0
          ? `${input.lateRollCalls} period(s) still missing roll call`
          : "You are notified when a teacher is 10+ min late starting roll call",
      href: "/app/notifications",
      done: (input.lateRollCalls ?? 0) === 0,
      core: false,
    },
  ];

  return {
    role: "principal",
    eyebrow: "Next steps",
    title: "Lead the school — not the register",
    description:
      "Your desk: invite staff, announce, calendar, oversight. Registrar enrols people; teachers mark roll call and results.",
    steps,
    storageKey: "zamschool.guide.principal.dismissed",
  };
}

export function buildRegistrarGuide(input: {
  classCount: number;
  studentCount: number;
  teacherCount: number;
  parentCount: number;
}): RoleOnboardingGuide {
  return {
    role: "registrar",
    eyebrow: "Enrolment guide",
    title: "Get the school roll ready",
    description:
      "Class → students (bulk OK) → teachers → link parents. Use CSV bulk upload on People when you have many records.",
    steps: [
      {
        id: "class",
        label: "Create first class",
        hint:
          input.classCount > 0
            ? `${input.classCount} class${input.classCount === 1 ? "" : "es"}`
            : "e.g. Grade 8A — needed before students",
        href: "/app/registrar/classes",
        done: input.classCount > 0,
      },
      {
        id: "students",
        label: "Enrol students (5+)",
        hint:
          input.studentCount >= 5
            ? `${input.studentCount} on roll`
            : input.studentCount > 0
              ? `${input.studentCount} so far — bulk upload speeds this up`
              : "Add one-by-one or bulk CSV on People",
        href: "/app/registrar/people",
        done: input.studentCount >= 5,
      },
      {
        id: "teachers",
        label: "Register teachers",
        hint:
          input.teacherCount > 0
            ? `${input.teacherCount} teacher${input.teacherCount === 1 ? "" : "s"}`
            : "Bulk import teachers, then assign classes/subjects",
        href: "/app/registrar/people",
        done: input.teacherCount > 0,
      },
      {
        id: "parents",
        label: "Link parents",
        hint:
          input.parentCount > 0
            ? `${input.parentCount} guardian account${input.parentCount === 1 ? "" : "s"}`
            : "Parents get absence & results alerts when linked",
        href: "/app/registrar/people",
        done: input.parentCount > 0,
        core: false,
      },
    ],
    storageKey: "zamschool.guide.registrar.dismissed",
  };
}

export function buildTeacherGuide(input: {
  hasClasses: boolean;
  hasRollCallToday: boolean;
  hasPublishedResults: boolean;
}): RoleOnboardingGuide {
  return {
    role: "teacher",
    eyebrow: "Teaching guide",
    title: "Your classroom essentials",
    description:
      "Mark roll call in the lesson window. Parents are alerted for absence. Publish results when every subject is ready.",
    steps: [
      {
        id: "classes",
        label: "Open today’s timetable",
        hint: input.hasClasses
          ? "You have lessons assigned"
          : "Ask Registrar/ICT if classes are empty",
        href: "/app/teacher/attendance",
        done: input.hasClasses,
      },
      {
        id: "rollcall",
        label: "Complete first roll call",
        hint: input.hasRollCallToday
          ? "Roll call submitted — families notified"
          : "Start within 10 min of period start or Head Teacher is alerted",
        href: "/app/teacher/attendance",
        done: input.hasRollCallToday,
      },
      {
        id: "results",
        label: "Enter & publish results",
        hint: input.hasPublishedResults
          ? "Results released to parents & students"
          : "CSV upload supported — certificates appear when all subjects are published",
        href: "/app/teacher/results",
        done: input.hasPublishedResults,
      },
    ],
    storageKey: "zamschool.guide.teacher.dismissed",
  };
}

export function buildStudentGuide(input: {
  hasResults: boolean;
  hasAbsences: boolean;
}): RoleOnboardingGuide {
  return {
    role: "student",
    eyebrow: "Getting started",
    title: "Your school portal",
    description:
      "Check attendance, download result certificates, and keep up with announcements.",
    steps: [
      {
        id: "results",
        label: "View & download certificates",
        hint: input.hasResults
          ? "Download Statement of Results (all subjects)"
          : "Certificates appear when teachers publish marks",
        href: "/app/student/results",
        done: input.hasResults,
      },
      {
        id: "attendance",
        label: "Check your attendance",
        hint: input.hasAbsences
          ? "You have absences recorded — talk to your class teacher if needed"
          : "Present / absent is updated after each roll call",
        href: "/app/student/attendance",
        done: !input.hasAbsences,
        core: false,
      },
      {
        id: "announcements",
        label: "Read school announcements",
        hint: "Head Teacher posts notices here",
        href: "/app/student/announcements",
        done: false,
        core: false,
      },
    ],
    storageKey: "zamschool.guide.student.dismissed",
  };
}

export function buildParentGuide(input: {
  hasChildren: boolean;
  hasResults: boolean;
  absentCount: number;
}): RoleOnboardingGuide {
  return {
    role: "parent",
    eyebrow: "Family guide",
    title: "Stay close to your child’s school day",
    description:
      "You get alerts when roll call is marked (including absence). Download certificates when results are published.",
    steps: [
      {
        id: "children",
        label: "Confirm linked children",
        hint: input.hasChildren
          ? "Children linked to your account"
          : "Ask the school Registrar to link you",
        href: "/app/parent",
        done: input.hasChildren,
      },
      {
        id: "absence",
        label: "Review absence alerts",
        hint:
          input.absentCount > 0
            ? `${input.absentCount} absence mark(s) recently — check details`
            : "You’ll be notified when a child is marked absent or late",
        href: "/app/parent/attendance",
        done: input.absentCount === 0,
      },
      {
        id: "results",
        label: "Download result certificates",
        hint: input.hasResults
          ? "Statement of Results ready (multi-subject)"
          : "Available after the school publishes marks",
        href: "/app/parent/results",
        done: input.hasResults,
      },
    ],
    storageKey: "zamschool.guide.parent.dismissed",
  };
}

export function countCoreProgress(steps: RoleOnboardingStep[]) {
  const core = steps.filter((s) => s.core !== false);
  const done = core.filter((s) => s.done).length;
  return { done, total: core.length };
}
