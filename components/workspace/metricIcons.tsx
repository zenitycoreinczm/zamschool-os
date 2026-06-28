import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  MessageSquare,
  School,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import type { WorkspaceMetric } from "@/lib/workspace/summary";

const LABEL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Attendance: ClipboardCheck,
  Outstanding: CreditCard,
  Students: Users,
  Teachers: Users,
  Classes: GraduationCap,
  Subjects: BookOpen,
  Assignments: BookOpen,
  Collected: CreditCard,
  Pending: CreditCard,
  Alerts: Bell,
  Staff: UserCog,
  Invites: UserCog,
  "Pending Invites": UserPlus,
  "Pending Invites ": UserPlus,
  Inbox: MessageSquare,
  Accounts: Users,
  "Audit (7d)": ShieldCheck,
  "Absent (7d)": AlertTriangle,
  "Late (7d)": AlertTriangle,
  Unread: MessageSquare,
  Children: Users,
  Messages: MessageSquare,
  Timetable: School,
};

export function metricsToStatCards(
  metrics: WorkspaceMetric[],
  fallbackIcons: ComponentType<{ className?: string }>[] = [BarChart3, Users, School, ClipboardCheck]
) {
  return metrics.map((metric, index) => ({
    label: metric.label,
    value: metric.value,
    hint: metric.hint,
    icon: LABEL_ICONS[metric.label] || fallbackIcons[index % fallbackIcons.length],
    tone: (["sky", "violet", "amber", "emerald"] as const)[index % 4],
  }));
}