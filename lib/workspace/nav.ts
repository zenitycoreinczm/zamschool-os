import type { ComponentType } from "react";
import {
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Shield,
  User,
  UserPlus,
  Users,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
  WandSparkles,
} from "lucide-react";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export type WorkspaceNavSection = {
  label: string;
  items: WorkspaceNavItem[];
};

export type WorkspaceRoleKey =
  | "admin"
  | "principal"
  | "deputy_head"
  | "bursar"
  | "guidance_office"
  | "academic_admin"
  | "hr_admin"
  | "ict_admin"
  | "discipline_admin"
  | "registrar"
  | "super_admin"
  | "teacher"
  | "student"
  | "parent"
  | "payments";

export function flattenNavSections(
  sections: WorkspaceNavSection[],
): WorkspaceNavItem[] {
  const seen = new Set<string>();
  const items: WorkspaceNavItem[] = [];

  for (const section of sections) {
    for (const item of section.items) {
      if (seen.has(item.href)) {
        continue;
      }
      seen.add(item.href);
      items.push(item);
    }
  }

  return items;
}

// Single source of truth for "the dashboard" per role. Replaces the
// mixed-state /app/dashboard, /app/teacher, /app/<role> entries so the
// first nav slot means the same thing across every workspace shell.
export const ROLE_DASHBOARD_PATHS: Record<WorkspaceRoleKey, string> = {
  // Legacy admin collapsed into Head Teacher (principal).
  admin: "/app/principal",
  principal: "/app/principal",
  deputy_head: "/app/deputy-head",
  bursar: "/app/bursar",
  guidance_office: "/app/guidance",
  academic_admin: "/app/academic-admin",
  hr_admin: "/app/hr-admin",
  ict_admin: "/app/ict-admin",
  discipline_admin: "/app/discipline-admin",
  registrar: "/app/registrar",
  super_admin: "/app/super-admin",
  teacher: "/app/teacher",
  student: "/app/student",
  parent: "/app/parent",
  payments: "/app/payments",
};

/** Role-owned settings path (includes MFA via AccountSettingsPage). */
export const ROLE_SETTINGS_PATHS: Record<WorkspaceRoleKey, string> = {
  // Legacy admin collapsed into Head Teacher (principal).
  admin: "/app/principal/settings",
  principal: "/app/principal/settings",
  deputy_head: "/app/deputy-head/settings",
  bursar: "/app/bursar/settings",
  guidance_office: "/app/guidance/settings",
  academic_admin: "/app/academic-admin/settings",
  hr_admin: "/app/hr-admin/settings",
  ict_admin: "/app/ict-admin/settings",
  discipline_admin: "/app/discipline-admin/settings",
  registrar: "/app/registrar/settings",
  super_admin: "/app/settings",
  teacher: "/app/teacher/settings",
  student: "/app/student/settings",
  parent: "/app/parent/settings",
  payments: "/app/payments/settings",
};

export function getRoleDashboardPath(role: WorkspaceRoleKey): string {
  return ROLE_DASHBOARD_PATHS[role] ?? ROLE_DASHBOARD_PATHS.admin;
}

export function getRoleSettingsPath(role: WorkspaceRoleKey): string {
  return ROLE_SETTINGS_PATHS[role] ?? "/app/settings";
}

/**
 * Shared "Today" strip for staff / leadership sidebars.
 * Home + school feed (messages, announcements, events).
 * Notifications live in the header bell next to messages, not the sidebar.
 */
export function staffTodayItems(options: {
  homeHref: string;
  homeLabel?: string;
  /** When false, omit Events (rare). Default true. */
  includeEvents?: boolean;
  /**
   * Notifications are header-only by default (bell next to messages).
   * Pass true only for rare roles that still need a sidebar entry.
   */
  includeNotifications?: boolean;
  /** When false, omit Announcements. Default true. */
  includeAnnouncements?: boolean;
}): WorkspaceNavItem[] {
  const {
    homeHref,
    homeLabel = "Dashboard",
    includeEvents = true,
    includeNotifications = false,
    includeAnnouncements = true,
  } = options;

  const items: WorkspaceNavItem[] = [
    { href: homeHref, label: homeLabel, icon: LayoutDashboard },
    { href: "/app/messages", label: "Messages", icon: MessageSquare },
  ];
  if (includeNotifications) {
    items.push({
      href: "/app/notifications",
      label: "Notifications",
      icon: Bell,
    });
  }
  if (includeAnnouncements) {
    items.push({
      href: "/app/announcements",
      label: "Announcements",
      icon: Megaphone,
    });
  }
  if (includeEvents) {
    items.push({ href: "/app/events", label: "Events", icon: Calendar });
  }
  return items;
}

const principalSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/principal",
      homeLabel: "Overview",
    }),
  },
  {
    label: "Governance",
    items: [
      { href: "/app/principal/staff", label: "Invite staff", icon: UserPlus },
      { href: "/app/admin/audit", label: "Audit trail", icon: Shield },
      { href: "/app/admin/school", label: "School profile", icon: Building2 },
      {
        href: "/app/admin/timetable",
        label: "Published timetables",
        icon: CalendarClock,
      },
    ],
  },
  {
    label: "Finance oversight",
    items: [
      {
        href: "/app/admin/finance",
        label: "Finance reports",
        icon: FileBarChart2,
      },
      { href: "/app/admin/fees", label: "Payments overview", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/principal/settings", label: "Settings", icon: Settings }],
  },
];

const deputyHeadSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/deputy-head",
      homeLabel: "Quality Hub",
    }),
  },
  {
    label: "Academic review",
    items: [
      {
        href: "/app/admin/timetable",
        label: "Review timetables",
        icon: CalendarClock,
      },
      {
        href: "/app/admin/attendance",
        label: "Attendance trends",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/deputy-head/settings", label: "Settings", icon: Settings },
    ],
  },
];

const bursarSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/bursar",
      homeLabel: "Finance Hub",
    }),
  },
  {
    label: "Finance",
    items: [
      { href: "/app/admin/finance", label: "Finance", icon: FileBarChart2 },
      { href: "/app/payments", label: "Payments", icon: CreditCard },
      {
        href: "/app/payments/students",
        label: "Student Accounts",
        icon: Users,
      },
      { href: "/app/payments/fees", label: "Fee Management", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/bursar/settings", label: "Settings", icon: Settings }],
  },
];

const guidanceSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/guidance",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Student care",
    items: [
      {
        href: "/app/admin/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
      {
        href: "/app/discipline-admin",
        label: "Conduct records",
        icon: Shield,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/guidance/settings", label: "Settings", icon: Settings },
    ],
  },
];

const academicAdminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/academic-admin",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Timetable",
    items: [
      {
        href: "/app/admin/timetable/classes",
        label: "Class timetable",
        icon: GraduationCap,
      },
      {
        href: "/app/admin/timetable/teachers",
        label: "Teacher timetable",
        icon: Users,
      },
      {
        href: "/app/admin/academic",
        label: "Years & terms",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Curriculum",
    items: [
      { href: "/app/admin/subjects", label: "Subjects", icon: FileText },
      { href: "/app/admin/assignments", label: "Assignments", icon: FileText },
      {
        href: "/app/admin/grading-scales",
        label: "Grading scales",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/academic-admin/settings", label: "Settings", icon: Settings }],
  },
];

const hrAdminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/hr-admin",
      homeLabel: "HR hub",
    }),
  },
  {
    label: "People",
    items: [
      { href: "/app/hr-admin/directory", label: "Staff directory", icon: Users },
      {
        href: "/app/admin/departments",
        label: "Departments",
        icon: Building2,
      },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/hr-admin/settings", label: "Settings", icon: Settings }],
  },
];

const ictAdminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/ict-admin",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Support",
    items: [
      { href: "/app/ict-admin/recovery", label: "User recovery", icon: Users },
      { href: "/app/admin/audit", label: "Audit trail", icon: Shield },
      { href: "/app/admin/school", label: "School profile", icon: Building2 },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/ict-admin/settings", label: "Settings", icon: Settings }],
  },
];

const disciplineAdminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/discipline-admin",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Conduct",
    items: [
      { href: "/app/admin/classes", label: "Classes", icon: GraduationCap },
      {
        href: "/app/admin/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/discipline-admin/settings", label: "Settings", icon: Settings }],
  },
];

const registrarSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/registrar",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Enrolment",
    items: [
      { href: "/app/registrar/people", label: "People", icon: Users },
      { href: "/app/registrar/classes", label: "Classes", icon: GraduationCap },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/registrar/settings", label: "Settings", icon: Settings },
    ],
  },
];

const appTeacherSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/teacher", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/teacher/teaching", label: "Schedule", icon: CalendarClock },
      { href: "/app/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/profile", label: "Profile", icon: Users },
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const appStudentSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/student", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/profile", label: "Profile", icon: Users },
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

// Parent portal sidebar uses the same sections as the portal dock.

export const paymentsSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: staffTodayItems({
      homeHref: "/app/payments",
      homeLabel: "Dashboard",
    }),
  },
  {
    label: "Billing",
    items: [
      {
        href: "/app/payments/students",
        label: "Student Payments",
        icon: Users,
      },
      { href: "/app/payments/fees", label: "Fee Management", icon: FileText },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/profile", label: "Profile", icon: Users },
      { href: "/app/payments/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const teacherPortalSections: WorkspaceNavSection[] = [
  {
    label: "Classroom",
    items: [
      { href: "/app/teacher", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/teacher/inbox", label: "Messages", icon: MessageSquare },
      { href: "/app/teacher/students", label: "Students", icon: Users },
      { href: "/app/teacher/classes", label: "Classes", icon: GraduationCap },
    ],
  },
  {
    label: "Teaching",
    items: [
      {
        href: "/app/teacher/teaching",
        label: "Schedule",
        icon: CalendarClock,
      },
      {
        href: "/app/teacher/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
      {
        href: "/app/teacher/assignments",
        label: "Assignments",
        icon: FileText,
      },
      { href: "/app/teacher/results", label: "Results", icon: GraduationCap },
      {
        href: "/app/teacher/report-cards",
        label: "Report Cards",
        icon: WandSparkles,
      },
      { href: "/app/teacher/discipline", label: "Conduct", icon: Shield },
    ],
  },
  {
    label: "School",
    items: [
      {
        href: "/app/teacher/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/app/teacher/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/teacher/profile", label: "Profile", icon: User },
      { href: "/app/teacher/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const studentPortalSections: WorkspaceNavSection[] = [
  {
    label: "School",
    items: [
      { href: "/app/student", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/app/student/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/app/student/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "My work",
    items: [
      {
        href: "/app/student/assignments",
        label: "Assignments",
        icon: BookOpen,
      },
      {
        href: "/app/student/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
      { href: "/app/student/results", label: "Results", icon: GraduationCap },
      { href: "/app/student/discipline", label: "Conduct", icon: Shield },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/student/profile", label: "Profile", icon: User },
      { href: "/app/student/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const parentPortalSections: WorkspaceNavSection[] = [
  {
    label: "Home",
    items: [
      { href: "/app/parent", label: "Dashboard", icon: LayoutDashboard },
      {
        href: "/app/parent/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/app/parent/messages", label: "Messages", icon: MessageSquare },
    ],
  },
  {
    label: "My children",
    items: [
      { href: "/app/parent/children", label: "Children", icon: Users },
      {
        href: "/app/parent/attendance",
        label: "Attendance",
        icon: CalendarCheck,
      },
      { href: "/app/parent/results", label: "Results", icon: GraduationCap },
      {
        href: "/app/parent/reports",
        label: "Report cards",
        icon: FileSpreadsheet,
      },
      { href: "/app/parent/discipline", label: "Conduct", icon: Shield },
    ],
  },
  {
    label: "School",
    items: [
      { href: "/app/parent/fees", label: "Fees", icon: CreditCard },
      { href: "/app/parent/absence", label: "Report absence", icon: AlertTriangle },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/parent/profile", label: "Profile", icon: User },
      { href: "/app/parent/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const roleNavSections: Record<WorkspaceRoleKey, WorkspaceNavSection[]> =
  {
    // Legacy School Administrator → same nav as Head Teacher (no Users directory).
    admin: principalSections,
    principal: principalSections,
    deputy_head: deputyHeadSections,
    bursar: bursarSections,
    guidance_office: guidanceSections,
    academic_admin: academicAdminSections,
    hr_admin: hrAdminSections,
    ict_admin: ictAdminSections,
    discipline_admin: disciplineAdminSections,
    registrar: registrarSections,
    super_admin: [
      {
        label: "Platform",
        items: [
          { href: "/app/super-admin", label: "Super Admin", icon: Shield },
        ],
      },
    ],
    teacher: appTeacherSections,
    student: appStudentSections,
    parent: parentPortalSections,
    payments: paymentsSections,
  };

export function getRoleNavItems(role: WorkspaceRoleKey): WorkspaceNavItem[] {
  return flattenNavSections(roleNavSections[role] || principalSections);
}

function pickDockItem(items: WorkspaceNavItem[], href: string) {
  return items.find((item) => item.href === href);
}

function uniqueDockItems(
  items: Array<WorkspaceNavItem | undefined | null>,
): WorkspaceNavItem[] {
  const seen = new Set<string>();
  const result: WorkspaceNavItem[] = [];

  for (const item of items) {
    if (!item || seen.has(item.href)) continue;
    seen.add(item.href);
    result.push(item);
  }

  return result;
}

export function buildRoleMobileDock(
  role: WorkspaceRoleKey,
): WorkspaceNavItem[] {
  const items = getRoleNavItems(role);
  const home = items[0];

  switch (role) {
    case "admin":
    case "principal":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        // Head Teacher invites staff; people directory is registrar/HR/ICT - not HT.
        pickDockItem(items, "/app/principal/staff"),
        pickDockItem(items, "/app/admin/finance"),
        {
          href: getRoleSettingsPath("principal"),
          label: "Settings",
          icon: Settings,
        },
      ]);
    case "deputy_head":
    case "guidance_office":
    case "discipline_admin":
    case "academic_admin":
    case "hr_admin":
    case "ict_admin":
    case "registrar":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/hr-admin/directory") ||
          pickDockItem(items, "/app/ict-admin/recovery") ||
          pickDockItem(items, "/app/registrar/people"),
        items.find((item) => item.href.includes("/admin/")) || items[1],
        {
          href: getRoleSettingsPath(role),
          label: "Settings",
          icon: Settings,
        },
      ]);
    case "bursar":
    case "payments":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/payments/students"),
        pickDockItem(items, "/app/payments/fees"),
        {
          href: getRoleSettingsPath(role),
          label: "Settings",
          icon: Settings,
        },
      ]);
    case "teacher":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/teacher"),
        pickDockItem(items, "/app/announcements"),
        {
          href: getRoleSettingsPath("teacher"),
          label: "Settings",
          icon: Settings,
        },
      ]);
    case "student":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/announcements"),
        { href: "/app/profile", label: "Profile", icon: Users },
        {
          href: getRoleSettingsPath("student"),
          label: "Settings",
          icon: Settings,
        },
      ]);
    case "parent":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/parent/messages"),
        pickDockItem(items, "/app/parent/children"),
        pickDockItem(items, "/app/parent/attendance"),
        {
          href: getRoleSettingsPath("parent"),
          label: "Settings",
          icon: Settings,
        },
      ]);
    default:
      return items.slice(0, 5);
  }
}

export function buildTeacherPortalDock(): WorkspaceNavItem[] {
  const items = flattenNavSections(teacherPortalSections);
  return [
    pickDockItem(items, "/app/teacher"),
    pickDockItem(items, "/app/teacher/inbox"),
    pickDockItem(items, "/app/teacher/students"),
    pickDockItem(items, "/app/teacher/attendance"),
    pickDockItem(items, "/app/teacher/profile"),
  ].filter(Boolean) as WorkspaceNavItem[];
}

export function buildStudentPortalDock(): WorkspaceNavItem[] {
  const items = flattenNavSections(studentPortalSections);
  return [
    pickDockItem(items, "/app/student"),
    pickDockItem(items, "/app/student/messages"),
    pickDockItem(items, "/app/student/assignments"),
    pickDockItem(items, "/app/student/profile"),
  ].filter(Boolean) as WorkspaceNavItem[];
}

export function buildParentPortalDock(): WorkspaceNavItem[] {
  const items = flattenNavSections(parentPortalSections);
  return [
    pickDockItem(items, "/app/parent"),
    pickDockItem(items, "/app/parent/messages"),
    pickDockItem(items, "/app/parent/children"),
    pickDockItem(items, "/app/parent/attendance"),
    pickDockItem(items, "/app/parent/fees"),
  ].filter(Boolean) as WorkspaceNavItem[];
}
