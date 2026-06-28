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
  admin: "/app/dashboard",
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

export function getRoleDashboardPath(role: WorkspaceRoleKey): string {
  return ROLE_DASHBOARD_PATHS[role] ?? ROLE_DASHBOARD_PATHS.admin;
}

const adminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
      { href: "/app/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "People & classes",
    items: [
      { href: "/app/admin/users", label: "Users", icon: Users },
      { href: "/app/admin/classes", label: "Classes", icon: GraduationCap },
      { href: "/app/admin/assignments", label: "Assignments", icon: FileText },
      { href: "/app/admin/timetable", label: "Timetable", icon: CalendarClock },
    ],
  },
  {
    label: "Academics",
    items: [
      { href: "/app/admin/subjects", label: "Subjects", icon: FileText },
      { href: "/app/admin/academic", label: "Academic Years", icon: Calendar },
      {
        href: "/app/admin/grading-scales",
        label: "Grades & Scales",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/app/admin/fees", label: "Payments", icon: CreditCard },
      { href: "/app/admin/finance", label: "Finance", icon: FileBarChart2 },
    ],
  },
  {
    label: "School & system",
    items: [
      { href: "/app/admin/school", label: "School", icon: Building2 },
      { href: "/app/admin/audit", label: "Audit", icon: Shield },
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const principalSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/principal", label: "Overview", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
      { href: "/app/announcements", label: "Announcements", icon: Megaphone },
      { href: "/app/events", label: "Events", icon: Calendar },
    ],
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
    items: [
      {
        href: "/app/deputy-head",
        label: "Quality Hub",
        icon: LayoutDashboard,
      },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
      { href: "/app/announcements", label: "Announcements", icon: Megaphone },
    ],
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
      { href: "/app/admin/assignments", label: "Assignments", icon: FileText },
    ],
  },
  {
    label: "Oversight",
    items: [
      { href: "/app/admin/users", label: "Staff & students", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/deputy-head/settings", label: "Settings", icon: Settings }],
  },
];

const bursarSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/bursar", label: "Finance Hub", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
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
    items: [
      { href: "/app/guidance", label: "Welfare Desk", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Student care",
    items: [
      { href: "/app/admin/users", label: "Students", icon: Users },
      {
        href: "/app/admin/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/guidance/settings", label: "Settings", icon: Settings }],
  },
];

const academicAdminSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      {
        href: "/app/academic-admin",
        label: "Academic Hub",
        icon: LayoutDashboard,
      },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Timetable",
    items: [
      {
        href: "/app/admin/timetable",
        label: "Class Timetables",
        icon: CalendarClock,
      },
      {
        href: "/app/admin/academic",
        label: "Academic Years & Terms",
        icon: Calendar,
      },
    ],
  },
  {
    label: "Curriculum",
    items: [
      { href: "/app/admin/classes", label: "Classes", icon: GraduationCap },
      { href: "/app/admin/subjects", label: "Subjects", icon: FileText },
      { href: "/app/admin/assignments", label: "Assignments", icon: FileText },
      {
        href: "/app/admin/grading-scales",
        label: "Grades & Scales",
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
    items: [
      { href: "/app/hr-admin", label: "HR Hub", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "People lifecycle",
    items: [
      { href: "/app/admin/users", label: "Staff & students", icon: Users },
    ],
  },
  {
    label: "Departments",
    items: [
      {
        href: "/app/admin/school",
        label: "School & departments",
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
    items: [
      { href: "/app/ict-admin", label: "ICT Hub", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/app/admin/users", label: "User Recovery", icon: Users },
      { href: "/app/admin/audit", label: "Audit", icon: Shield },
      { href: "/app/admin/school", label: "School", icon: Building2 },
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
    items: [
      {
        href: "/app/discipline-admin",
        label: "Conduct Desk",
        icon: LayoutDashboard,
      },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Students",
    items: [
      { href: "/app/admin/users", label: "Students", icon: Users },
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
    items: [
      {
        href: "/app/registrar",
        label: "Admissions Desk",
        icon: LayoutDashboard,
      },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "Admissions",
    items: [
      { href: "/app/admin/users", label: "Students, Teachers & Parents", icon: Users },
      { href: "/app/admin/classes", label: "Classes", icon: GraduationCap },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/registrar/settings", label: "Settings", icon: Settings }],
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
      { href: "/app/notifications", label: "Notifications", icon: Bell },
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
      { href: "/app/notifications", label: "Notifications", icon: Bell },
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
    items: [
      { href: "/app/payments", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/notifications", label: "Notifications", icon: Bell },
    ],
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
      { href: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const teacherPortalSections: WorkspaceNavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/app/teacher", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/teacher/inbox", label: "Messages", icon: MessageSquare },
      {
        href: "/app/teacher/notifications",
        label: "Notifications",
        icon: Bell,
      },
    ],
  },
  {
    label: "Teaching",
    items: [
      { href: "/app/teacher/students", label: "Students", icon: Users },
      { href: "/app/teacher/teaching", label: "Teaching", icon: GraduationCap },
      { href: "/app/teacher/classes", label: "Classes", icon: GraduationCap },
      {
        href: "/app/teacher/attendance",
        label: "Attendance",
        icon: ClipboardList,
      },
      { href: "/app/teacher/results", label: "Results", icon: GraduationCap },
      { href: "/app/teacher/discipline", label: "Discipline", icon: Shield },
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
    label: "Today",
    items: [
      { href: "/app/student", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/student/messages", label: "Messages", icon: MessageSquare },
      {
        href: "/app/student/notifications",
        label: "Notifications",
        icon: Bell,
      },
      {
        href: "/app/student/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/app/student/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "School work",
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
    label: "Today",
    items: [
      { href: "/app/parent", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/parent/messages", label: "Messages", icon: MessageSquare },
      { href: "/app/parent/notifications", label: "Notifications", icon: Bell },
      {
        href: "/app/parent/announcements",
        label: "Announcements",
        icon: Megaphone,
      },
      { href: "/app/parent/events", label: "Events", icon: Calendar },
    ],
  },
  {
    label: "My children",
    items: [
      { href: "/app/parent/children", label: "My Children", icon: Users },
      {
        href: "/app/parent/attendance",
        label: "Attendance",
        icon: CalendarCheck,
      },
      { href: "/app/parent/results", label: "Results", icon: GraduationCap },
      { href: "/app/parent/discipline", label: "Conduct", icon: Shield },
      {
        href: "/app/parent/reports",
        label: "Report Cards",
        icon: FileSpreadsheet,
      },
      {
        href: "/app/parent/timetable",
        label: "Timetable",
        icon: CalendarClock,
      },
      { href: "/app/parent/teachers", label: "Teachers", icon: BookOpen },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/app/parent/fees", label: "School Fees", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/app/parent/absence", label: "Absence", icon: AlertTriangle },
      { href: "/app/parent/profile", label: "Profile", icon: User },
      { href: "/app/parent/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const roleNavSections: Record<WorkspaceRoleKey, WorkspaceNavSection[]> =
  {
    admin: adminSections,
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
  return flattenNavSections(roleNavSections[role] || adminSections);
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
        pickDockItem(items, "/app/admin/users"),
        pickDockItem(items, "/app/admin/finance"),
        { href: "/app/profile", label: "Profile", icon: Settings },
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
        pickDockItem(items, "/app/admin/users"),
        items.find((item) => item.href.includes("/admin/")) || items[1],
        { href: "/app/settings", label: "Settings", icon: Settings },
      ]);
    case "bursar":
    case "payments":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/payments/students"),
        pickDockItem(items, "/app/payments/fees"),
        { href: "/app/profile", label: "Profile", icon: Settings },
      ]);
    case "teacher":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/teacher"),
        pickDockItem(items, "/app/announcements"),
        { href: "/app/profile", label: "Profile", icon: Settings },
      ]);
    case "student":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/messages"),
        pickDockItem(items, "/app/announcements"),
        { href: "/app/profile", label: "Profile", icon: Users },
        { href: "/app/settings", label: "Settings", icon: Settings },
      ]);
    case "parent":
      return uniqueDockItems([
        home,
        pickDockItem(items, "/app/parent/messages"),
        pickDockItem(items, "/app/parent/children"),
        pickDockItem(items, "/app/parent/attendance"),
        pickDockItem(items, "/app/parent/fees"),
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
    pickDockItem(items, "/app/teacher/teaching"),
    pickDockItem(items, "/app/teacher/settings"),
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
