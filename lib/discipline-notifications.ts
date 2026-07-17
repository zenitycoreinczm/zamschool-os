import { supabaseAdmin } from "@/lib/supabase";

export async function buildDisciplineRecordNotificationPayloads(input: {
  schoolId: string;
  studentId: string;
  studentProfileId: string;
  recordId: string;
  title: string;
  severity: number;
  status: string;
  incidentDate: string;
  reportedByName: string;
}): Promise<Array<{
  user_id: string;
  dedupe_key: string;
  title: string;
  message: string;
  type: string;
}>> {
  const severityLabels: Record<number, string> = {
    1: "Low",
    2: "Minor",
    3: "Moderate",
    4: "Serious",
    5: "Critical",
  };
  const severityLabel = severityLabels[input.severity] || "Low";

  const title = `Discipline record: ${input.title}`;
  const message = `A ${severityLabel.toLowerCase()} severity discipline record "${input.title}" was filed for your child on ${input.incidentDate} by ${input.reportedByName}. Status: ${input.status}.`;

  // Resolve parent profile IDs for this student
  const parentProfileIds = await resolveParentProfileIds(input.schoolId, input.studentId);

  const recipientIds = [input.studentProfileId, ...parentProfileIds].filter(Boolean);

  return Array.from(new Set(recipientIds)).map((recipientId) => ({
    user_id: recipientId,
    dedupe_key: `${recipientId}:discipline:${input.recordId}`,
    title,
    message,
    type: "general",
  }));
}

export async function buildDisciplineStatusChangeNotificationPayloads(input: {
  schoolId: string;
  studentId: string;
  studentProfileId: string;
  recordId: string;
  title: string;
  newStatus: string;
  resolvedByName: string;
}): Promise<Array<{
  user_id: string;
  dedupe_key: string;
  title: string;
  message: string;
  type: string;
}>> {
  const title = `Discipline record updated: ${input.title}`;
  const message = `The discipline record "${input.title}" has been ${input.newStatus} by ${input.resolvedByName}.`;

  const parentProfileIds = await resolveParentProfileIds(input.schoolId, input.studentId);
  const recipientIds = [input.studentProfileId, ...parentProfileIds].filter(Boolean);

  return Array.from(new Set(recipientIds)).map((recipientId) => ({
    user_id: recipientId,
    dedupe_key: `${recipientId}:discipline-status:${input.recordId}:${input.newStatus}`,
    title,
    message,
    type: "general",
  }));
}

async function resolveParentProfileIds(schoolId: string, studentId: string): Promise<string[]> {
  // Look up student profile_id
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("profile_id")
    .eq("id", studentId)
    .eq("school_id", schoolId)
    .maybeSingle();

  const linkKeys = [studentId, student?.profile_id].filter(Boolean) as string[];
  if (linkKeys.length === 0) return [];

  const { loadParentProfileIdsByStudentRowId } = await import(
    "@/lib/attendance/parent-recipients"
  );
  const map = await loadParentProfileIdsByStudentRowId({
    schoolId,
    rosterRows: [
      { id: studentId, profile_id: student?.profile_id || null },
    ],
  });
  return map.get(studentId) || [];
}
