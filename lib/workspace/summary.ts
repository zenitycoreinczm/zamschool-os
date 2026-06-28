import { buildAttendanceWindow, summarizeAttendance } from "@/lib/attendance/summary";
import { roleDatabaseValues, type KnownRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";

export type WorkspaceMetric = {
  label: string;
  value: string;
  hint?: string;
};

export type WorkspaceSummary = {
  role: KnownRole;
  metrics: WorkspaceMetric[];
  highlights: string[];
};

export async function buildWorkspaceSummary(input: {
  schoolId: string;
  role: KnownRole;
  userId: string;
}): Promise<WorkspaceSummary> {
  const { schoolId, role, userId } = input;

  const profileCounts = await loadProfileCounts(schoolId);
  if (role === "PARENT") {
    profileCounts.linkedChildren = await loadLinkedChildrenCount(schoolId, userId);
  }

  const [
    unread,
    attendanceSnapshot,
    classCount,
    subjectCount,
    assignmentCount,
    pendingInvites,
    financeSnapshot,
    auditCount,
  ] = await Promise.all([
    loadUnreadCounts(userId),
    loadAttendanceSnapshot(schoolId),
    countRows("classes", schoolId),
    countRows("subjects", schoolId),
    countRows("assignments", schoolId),
    countPendingInvitations(schoolId),
    loadFinanceSnapshot(schoolId),
    countRecentAudit(schoolId),
  ]);

  const metrics = metricsForRole(role, {
    profileCounts,
    unread,
    attendanceSnapshot,
    classCount,
    subjectCount,
    assignmentCount,
    pendingInvites,
    financeSnapshot,
    auditCount,
  });

  return {
    role,
    metrics,
    highlights: highlightsForRole(role, {
      profileCounts,
      attendanceSnapshot,
      pendingInvites,
      financeSnapshot,
    }),
  };
}

function metricsForRole(
  role: KnownRole,
  data: {
    profileCounts: ProfileCounts;
    unread: UnreadCounts;
    attendanceSnapshot: AttendanceSnapshot;
    classCount: number;
    subjectCount: number;
    assignmentCount: number;
    pendingInvites: number;
    financeSnapshot: FinanceSnapshot;
    auditCount: number;
  }
): WorkspaceMetric[] {
  const { profileCounts, unread, attendanceSnapshot, financeSnapshot } = data;

  switch (role) {
    case "PRINCIPAL":
      return [
        metric("Classes", String(data.classCount), "Active classes"),
        metric("Pending Invites", String(data.pendingInvites), "Awaiting acceptance"),
        metric("Attendance", `${attendanceSnapshot.presentRate}%`, "Present rate (7 days)"),
        metric("Outstanding", formatMoney(financeSnapshot.pending), "Unpaid fee balances"),
      ];
    case "ADMIN":
      return [
        metric("Students", String(profileCounts.student)),
        metric("Teachers", String(profileCounts.teacher)),
        metric("Attendance", `${attendanceSnapshot.presentRate}%`, "Last 7 days"),
        metric("Outstanding", formatMoney(financeSnapshot.pending), "Unpaid fee balances"),
      ];
    case "DEPUTY_HEAD":
      return [
        metric("Students", String(profileCounts.student)),
        metric("Teachers", String(profileCounts.teacher)),
        metric("Classes", String(data.classCount)),
        metric("Absent (7d)", String(attendanceSnapshot.absent), "Lessons marked absent"),
      ];
    case "BURSAR":
    case "PAYMENTS":
      return [
        metric("Collected", formatMoney(financeSnapshot.collected)),
        metric("Pending", formatMoney(financeSnapshot.pending)),
        metric("Students", String(profileCounts.student)),
        metric("Alerts", String(unread.notifications), "Unread notifications"),
      ];
    case "ACADEMIC_ADMIN":
      return [
        metric("Classes", String(data.classCount)),
        metric("Subjects", String(data.subjectCount)),
        metric("Assignments", String(data.assignmentCount)),
        metric("Teachers", String(profileCounts.teacher)),
      ];
    case "HR_ADMIN":
      return [
        metric("Staff", String(profileCounts.staff)),
        metric("Teachers", String(profileCounts.teacher)),
        metric("Invites", String(data.pendingInvites), "Pending staff invitations"),
        metric("Inbox", String(unread.messages), "Unread messages"),
      ];
    case "ICT_ADMIN":
      return [
        metric("Accounts", String(profileCounts.total)),
        metric("Audit (7d)", String(data.auditCount), "Security events"),
        metric("Teachers", String(profileCounts.teacher)),
        metric("Alerts", String(unread.notifications), "Unread notifications"),
      ];
    case "GUIDANCE_OFFICE":
    case "DISCIPLINE_ADMIN":
      return [
        metric("Students", String(profileCounts.student)),
        metric("Absent (7d)", String(attendanceSnapshot.absent)),
        metric("Late (7d)", String(attendanceSnapshot.late)),
        metric("Inbox", String(unread.messages), "Unread messages"),
      ];
    case "TEACHER":
      return [
        metric("Unread", String(unread.messages + unread.notifications)),
        metric("Students", String(profileCounts.student), "School-wide"),
        metric("Classes", String(data.classCount)),
        metric("Assignments", String(data.assignmentCount), "School setup"),
      ];
    case "STUDENT":
      return [
        metric("Attendance", `${attendanceSnapshot.presentRate}%`, "Your recent records"),
        metric("Assignments", String(data.assignmentCount), "Active in school"),
        metric("Messages", String(unread.messages), "Unread"),
        metric("Alerts", String(unread.notifications), "Unread"),
      ];
    case "PARENT":
      return [
        metric("Children", String(profileCounts.linkedChildren || 0)),
        metric("Messages", String(unread.messages), "Unread"),
        metric("Alerts", String(unread.notifications), "Unread"),
        metric("Absent (7d)", String(attendanceSnapshot.absent), "Linked children"),
      ];
    default:
      return [
        metric("Students", String(profileCounts.student)),
        metric("Teachers", String(profileCounts.teacher)),
        metric("Inbox", String(unread.messages + unread.notifications)),
        metric("Classes", String(data.classCount)),
      ];
  }
}

function highlightsForRole(
  role: KnownRole,
  data: {
    profileCounts: ProfileCounts;
    attendanceSnapshot: AttendanceSnapshot;
    pendingInvites: number;
    financeSnapshot: FinanceSnapshot;
  }
): string[] {
  const items: string[] = [];

  if (["PRINCIPAL", "ADMIN", "DEPUTY_HEAD"].includes(role)) {
    items.push(`${data.profileCounts.student} learners on roll`);
    if (data.profileCounts.teacher > 0) {
      items.push(`${data.profileCounts.teacher} teachers on staff`);
    }
    if (data.attendanceSnapshot.absent > 0) {
      items.push(`${data.attendanceSnapshot.absent} absent lesson marks in the last 7 days`);
    }
    if (["PRINCIPAL", "ADMIN"].includes(role) && data.financeSnapshot.pending > 0) {
      items.push(`${formatMoney(data.financeSnapshot.pending)} outstanding in fee balances`);
    }
    if (role === "PRINCIPAL" && data.pendingInvites > 0) {
      items.push(`${data.pendingInvites} staff invitation(s) awaiting acceptance`);
    }
  }

  if (role === "HR_ADMIN" && data.pendingInvites > 0) {
    items.push(`${data.pendingInvites} staff invitation(s) awaiting acceptance`);
  }

  if (["BURSAR", "PAYMENTS"].includes(role) && data.financeSnapshot.pending > 0) {
    items.push(`${formatMoney(data.financeSnapshot.pending)} still pending collection`);
  }

  if (["ACADEMIC_ADMIN"].includes(role)) {
    items.push("Academic structure modules are ready from your workspace tools");
  }

  if (items.length === 0) {
    items.push("Live school metrics are connected to your workspace");
  }

  return items.slice(0, 4);
}

type ProfileCounts = {
  total: number;
  student: number;
  teacher: number;
  parent: number;
  staff: number;
  linkedChildren?: number;
};

type UnreadCounts = {
  messages: number;
  notifications: number;
};

type AttendanceSnapshot = {
  presentRate: number;
  absent: number;
  late: number;
};

type FinanceSnapshot = {
  collected: number;
  pending: number;
};

async function loadProfileCounts(schoolId: string): Promise<ProfileCounts> {
  const [studentRows, teacherRows, parentRows] = await Promise.all([
    countRows("students", schoolId),
    countRows("teachers", schoolId),
    countRows("parents", schoolId),
  ]);
  const roles = ["student", "teacher", "parent", "admin", "principal", "deputy_head", "bursar"];
  const counts: ProfileCounts = {
    total: 0,
    student: 0,
    teacher: 0,
    parent: 0,
    staff: 0,
  };

  for (const role of roles) {
    const variants = roleDatabaseValues(role);
    if (variants.length === 0) continue;

    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .in("role", variants);

    if (error) continue;
    const value = count || 0;
    counts.total += value;

    if (role === "student") counts.student = value;
    if (role === "teacher") counts.teacher = value;
    if (role === "parent") counts.parent = value;
    if (role !== "student" && role !== "parent") counts.staff += value;
  }

  counts.student = Math.max(counts.student, studentRows);
  counts.teacher = Math.max(counts.teacher, teacherRows);
  counts.parent = Math.max(counts.parent, parentRows);
  counts.staff = Math.max(counts.staff, counts.teacher);
  counts.total = Math.max(
    counts.total,
    counts.student + counts.parent + counts.staff,
  );

  return counts;
}

async function loadUnreadCounts(userId: string): Promise<UnreadCounts> {
  const [messagesResult, notificationsResult] = await Promise.all([
    supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("is_read", false),
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false),
  ]);

  return {
    messages: messagesResult.count || 0,
    notifications: notificationsResult.count || 0,
  };
}

async function loadAttendanceSnapshot(schoolId: string): Promise<AttendanceSnapshot> {
  const { startDate, endDate } = buildAttendanceWindow("7d", null);
  const { data, error } = await supabaseAdmin
    .from("attendance")
    .select("status")
    .eq("school_id", schoolId)
    .gte("date", startDate)
    .lte("date", endDate)
    .limit(500);

  if (error) {
    return { presentRate: 0, absent: 0, late: 0 };
  }

  const summary = summarizeAttendance(
    (data || []).map((row: { status?: string | null }) => ({
      status: String(row.status || "ABSENT").toUpperCase(),
    }))
  );

  const total =
    summary.PRESENT + summary.ABSENT + summary.LATE + summary.EXCUSED;
  const presentLike = summary.PRESENT + summary.LATE + summary.EXCUSED;

  return {
    presentRate: total > 0 ? Math.round((presentLike / total) * 100) : 0,
    absent: summary.ABSENT,
    late: summary.LATE,
  };
}

async function countRows(table: string, schoolId: string) {
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (error) return 0;
  return count || 0;
}

async function countPendingInvitations(schoolId: string) {
  const { count, error } = await supabaseAdmin
    .from("staff_invitations")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) return 0;
  return count || 0;
}

async function loadFinanceSnapshot(schoolId: string): Promise<FinanceSnapshot> {
  const { data, error } = await supabaseAdmin
    .from("payments")
    .select("amount, status")
    .eq("school_id", schoolId)
    .limit(500);

  if (error) {
    return { collected: 0, pending: 0 };
  }

  return (data || []).reduce(
    (acc, row: { amount?: number | null; status?: string | null }) => {
      const amount = Number(row.amount || 0);
      if (String(row.status || "").toUpperCase() === "PAID") {
        acc.collected += amount;
      } else {
        acc.pending += amount;
      }
      return acc;
    },
    { collected: 0, pending: 0 }
  );
}

async function loadLinkedChildrenCount(schoolId: string, parentProfileId: string) {
  const { data: parentRow } = await supabaseAdmin
    .from("parents")
    .select("id")
    .eq("profile_id", parentProfileId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!parentRow?.id) {
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("parent_id", parentProfileId);
    return count || 0;
  }

  const { count } = await supabaseAdmin
    .from("parent_students")
    .select("student_id", { count: "exact", head: true })
    .eq("parent_id", parentRow.id);

  return count || 0;
}

async function countRecentAudit(schoolId: string) {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { count, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .gte("created_at", since.toISOString());

  if (error) return 0;
  return count || 0;
}

function metric(label: string, value: string, hint?: string): WorkspaceMetric {
  return { label, value, hint };
}

function formatMoney(value: number) {
  return `ZMW ${Math.round(value).toLocaleString()}`;
}
