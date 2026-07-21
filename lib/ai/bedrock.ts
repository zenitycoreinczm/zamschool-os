import {
  BedrockRuntimeClient,
  ConverseCommand,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";

// Prefer cross-region inference profile (us.*) when account TPM quotas unlock.
const DEFAULT_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  "us.anthropic.claude-3-haiku-20240307-v1:0";

const DEFAULT_REGION = process.env.BEDROCK_REGION || "us-east-1";

let client: BedrockRuntimeClient | null = null;

/**
 * Auth order:
 * 1. Bedrock long-term API key (ABSK… via BEDROCK_API_KEY or AWS_BEARER_TOKEN_BEDROCK)
 * 2. Static IAM access keys (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)
 * 3. Default provider chain (instance role, aws login, etc.)
 *
 * API keys must be exposed as AWS_BEARER_TOKEN_BEDROCK — the Bedrock Runtime
 * SDK reads that env var for Bearer auth (do not pass a custom token provider).
 */
function getClient(): BedrockRuntimeClient {
  if (!client) {
    const region = process.env.BEDROCK_REGION || DEFAULT_REGION;
    const apiKey =
      process.env.BEDROCK_API_KEY?.trim() ||
      process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() ||
      "";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (apiKey) {
      process.env.AWS_BEARER_TOKEN_BEDROCK = apiKey;
      // No credentials option — bearer middleware uses AWS_BEARER_TOKEN_BEDROCK.
      client = new BedrockRuntimeClient({ region });
    } else if (accessKeyId && secretAccessKey) {
      client = new BedrockRuntimeClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      client = new BedrockRuntimeClient({ region });
    }
  }
  return client;
}

function isThrottlingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: string; message?: string; Code?: string };
  const name = e.name ?? e.Code ?? "";
  const msg = e.message ?? "";
  return (
    name.includes("Throttling") ||
    msg.includes("Too many tokens") ||
    msg.includes("ThrottlingException")
  );
}

export type StudentDataForComment = {
  studentName: string;
  className: string;
  termName: string;
  subjects: Array<{
    name: string;
    score: number | null;
    maxScore: number | null;
    grade: string | null;
  }>;
  attendanceRate: number | null;
  flags: string[];
  riskLevel: string;
};

const SYSTEM_PROMPT = `You are a helpful Zambian school teacher assistant. Your task is to generate **brief, personalised report card comments** for each student.

**Rules:**
1. Write 2-3 sentences max per student.
2. Use a supportive, encouraging tone. Every student can improve.
3. Be specific — reference the student's strengths and areas for growth based on their scores.
4. If attendance is low or there are risk flags, gently mention it and encourage improvement.
5. Use British English spelling (e.g. "behaviour", "colour", "organised", "programme", "favourite").
6. Output ONLY the comment text — no labels, no prefixes, no "Comment:".
7. Do NOT use markdown or bullet points — just plain sentences.
8. For younger students (primary), use simpler language. For secondary, use more formal language.`;

function buildPrompt(data: StudentDataForComment): string {
  const subjectLines = data.subjects
    .map(
      (s) =>
        `- ${s.name}: ${s.score != null ? `${s.score}/${s.maxScore ?? 100}` : "No score"}${s.grade ? ` (Grade: ${s.grade})` : ""}`,
    )
    .join("\n");

  const attendanceLine =
    data.attendanceRate != null
      ? `Attendance rate: ${data.attendanceRate}%`
      : "Attendance data not available";

  const flagsLine =
    data.flags.length > 0
      ? `Concerns: ${data.flags.join(", ")} (Risk level: ${data.riskLevel})`
      : "No major concerns noted."

  return `Generate a report card comment for:
Student: ${data.studentName}
Class: ${data.className}
Term: ${data.termName}

Subjects:
${subjectLines}

${attendanceLine}
${flagsLine}`;
}

export async function generateReportCardComment(
  data: StudentDataForComment,
): Promise<string> {
  try {
    const runtimeClient = getClient();
    const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;

    const messages: Message[] = [
      {
        role: "user",
        content: [{ text: buildPrompt(data) }],
      },
    ];

    const command = new ConverseCommand({
      modelId,
      messages,
      system: [{ text: SYSTEM_PROMPT }],
      inferenceConfig: {
        maxTokens: 200,
        temperature: 0.7,
      },
    });

    const response = await runtimeClient.send(command);
    const text = response.output?.message?.content?.[0]?.text;

    if (!text) {
      return `${data.studentName} is making progress. Keep up the good work and stay focused on your studies.`;
    }

    return text.trim();
  } catch (error) {
    if (isThrottlingError(error)) {
      console.error(
        "[Bedrock] Throttled (daily/TPM quota). Check Service Quotas for Bedrock in us-east-1.",
        error,
      );
    } else {
      console.error("[Bedrock] Failed to generate comment:", error);
    }
    return `${data.studentName} is encouraged to continue working hard and participating actively in class.`;
  }
}

export async function generateBatchComments(
  students: StudentDataForComment[],
): Promise<string[]> {
  return Promise.all(students.map(generateReportCardComment));
}

export type TeacherAssistantRequest = {
  displayName: string;
  pendingRollCalls: number;
  draftResults: number;
  unreadMessages: number;
  unreadNotifications: number;
  upcomingEvents: number;
  totalStudents: number;
  highRiskStudents: number;
  mediumRiskStudents: number;
  assignedClasses: string[];
  assignedSubjects: string[];
};

export type TeacherRecommendation = {
  priority: "high" | "medium" | "low";
  action: string;
  reason: string;
  link?: string;
};

const TEACHER_ASSISTANT_SYSTEM_PROMPT = `You are an AI teaching assistant for Zambian schools. Your role is to help teachers prioritise their daily tasks.

Given the teacher's current workload, suggest 3-5 actionable recommendations in order of priority.

**Rules:**
1. Output ONLY a JSON array of objects, each with: priority ("high"/"medium"/"low"), action (short title), reason (1 sentence), and link (URL path like "/app/teacher/attendance").
2. Focus on urgent tasks first (unmarked attendance, results to publish, high-risk students).
3. Be concise and practical. Teachers are busy.
4. Use British English spelling.
5. Output raw JSON only — no markdown, no backticks, no prefixes.`;

export async function generateTeacherRecommendations(
  data: TeacherAssistantRequest,
): Promise<TeacherRecommendation[]> {
  try {
    const prompt = `Teacher: ${data.displayName}
Pending roll calls: ${data.pendingRollCalls}
Draft results to publish: ${data.draftResults}
Unread messages: ${data.unreadMessages}
Unread notifications: ${data.unreadNotifications}
Upcoming events: ${data.upcomingEvents}
Total students: ${data.totalStudents}
High-risk students: ${data.highRiskStudents}
Medium-risk students: ${data.mediumRiskStudents}
Classes: ${data.assignedClasses.join(", ") || "None"}
Subjects: ${data.assignedSubjects.join(", ") || "None"}

Based on this data, what should the teacher do next? Provide 3-5 JSON recommendations.`;

    const result = await callBedrock(prompt, TEACHER_ASSISTANT_SYSTEM_PROMPT, 500);
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 5) as TeacherRecommendation[];
    }
    return fallbackRecommendations(data);
  } catch {
    return fallbackRecommendations(data);
  }
}

function fallbackRecommendations(data: TeacherAssistantRequest): TeacherRecommendation[] {
  const recs: TeacherRecommendation[] = [];
  if (data.pendingRollCalls > 0) {
    recs.push({ priority: "high", action: "Record attendance", reason: `${data.pendingRollCalls} roll call(s) still pending for today.`, link: "/app/teacher/attendance" });
  }
  if (data.draftResults > 0) {
    recs.push({ priority: "high", action: "Publish results", reason: `${data.draftResults} draft result set(s) ready for release.`, link: "/app/teacher/results" });
  }
  if (data.highRiskStudents > 0) {
    recs.push({ priority: "high", action: "Check at-risk students", reason: `${data.highRiskStudents} student(s) need attention due to low performance or attendance.`, link: "/app/teacher/students" });
  }
  if (data.unreadMessages > 0) {
    recs.push({ priority: "medium", action: "Read messages", reason: `${data.unreadMessages} unread message(s) from parents or staff.`, link: "/app/teacher/inbox" });
  }
  recs.push({ priority: "low", action: "Review upcoming events", reason: `${data.upcomingEvents} event(s) coming up — check your schedule.`, link: "/app/teacher/events" });
  return recs;
}

export type StudentTipsRequest = {
  studentName: string;
  averageScore: number | null;
  attendanceRate: number | null;
  totalAssignments: number;
  completedAssignments: number;
  recentSubjects: Array<{ name: string; score: number | null }>;
  className: string;
};

const STUDENT_TIPS_SYSTEM_PROMPT = `You are a supportive AI study coach for Zambian school students.

Given the student's academic data, generate 3 short, encouraging study tips.

**Rules:**
1. Be positive and encouraging. Focus on improvement.
2. Be specific — reference their subjects and scores where relevant.
3. Keep each tip to 1-2 sentences.
4. Use British English spelling.
5. Output ONLY a JSON array of strings — no markdown, no backticks, no prefixes.`;

export async function generateStudentStudyTips(
  data: StudentTipsRequest,
): Promise<string[]> {
  try {
    const subjectLines = data.recentSubjects
      .map((s) => `- ${s.name}: ${s.score != null ? `${s.score}%` : "No score"}`)
      .join("\n");

    const prompt = `Student: ${data.studentName}
Class: ${data.className}
Average score: ${data.averageScore != null ? `${data.averageScore}%` : "N/A"}
Attendance: ${data.attendanceRate != null ? `${data.attendanceRate}%` : "N/A"}
Assignments: ${data.completedAssignments} of ${data.totalAssignments} completed

Recent subjects:
${subjectLines || "No recent subjects"}

Generate 3 short study tips as a JSON array of strings.`;

    const result = await callBedrock(prompt, STUDENT_TIPS_SYSTEM_PROMPT, 400);
    const parsed = JSON.parse(result);
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 3).map(String);
    }
    return fallbackStudyTips(data);
  } catch {
    return fallbackStudyTips(data);
  }
}

function fallbackStudyTips(data: StudentTipsRequest): string[] {
  const tips: string[] = [];
  if ((data.averageScore ?? 0) < 50) {
    tips.push("Focus on improving your understanding of key subjects — ask your teacher for extra help.");
  } else {
    tips.push("Keep up the great work! Stay consistent with your study routine.");
  }
  if ((data.attendanceRate ?? 100) < 80) {
    tips.push("Try to attend all classes — being present is the first step to doing well.");
  }
  tips.push("Review your notes regularly and don't be afraid to ask questions in class.");
  return tips;
}

export type ParentSummaryRequest = {
  parentName: string;
  children: Array<{
    name: string;
    className: string;
    averageScore: number | null;
    attendanceRate: number | null;
    totalResults: number;
    riskFlags: string[];
  }>;
};

const PARENT_SUMMARY_SYSTEM_PROMPT = `You are a supportive AI assistant for parents of Zambian school students.

Given each child's academic data, generate a brief, encouraging progress summary.

**Rules:**
1. Write 2-3 sentences per child.
2. Be positive and constructive. Highlight strengths then gently note areas for improvement.
3. Use plain language that any parent can understand.
4. Use British English spelling.
5. Output ONLY a JSON object where keys are child names and values are the summary text — no markdown, no backticks.`;

export async function generateParentProgressSummary(
  data: ParentSummaryRequest,
): Promise<Record<string, string>> {
  try {
    const childrenLines = data.children
      .map(
        (c) =>
          `${c.name} (${c.className}): Avg ${c.averageScore != null ? `${c.averageScore}%` : "N/A"}, Attendance ${c.attendanceRate != null ? `${c.attendanceRate}%` : "N/A"}, ${c.totalResults} results. Flags: ${c.riskFlags.join(", ") || "None"}`,
      )
      .join("\n");

    const prompt = `Parent: ${data.parentName}
Children:
${childrenLines}

Generate a JSON object with progress summaries for each child.`;

    const result = await callBedrock(prompt, PARENT_SUMMARY_SYSTEM_PROMPT, 600);
    const parsed = JSON.parse(result);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, string>;
    }
    return fallbackParentSummary(data);
  } catch {
    return fallbackParentSummary(data);
  }
}

function fallbackParentSummary(
  data: ParentSummaryRequest,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const child of data.children) {
    const parts: string[] = [];
    if ((child.averageScore ?? 0) >= 75) {
      parts.push(`${child.name} is performing well with an average of ${child.averageScore}%.`);
    } else if ((child.averageScore ?? 0) >= 50) {
      parts.push(`${child.name} is making steady progress with an average of ${child.averageScore}%. Encourage them to keep working hard.`);
    } else {
      parts.push(`${child.name} could benefit from extra academic support — their average is ${child.averageScore ?? "not yet available"}.`);
    }
    if ((child.attendanceRate ?? 100) < 80) {
      parts.push(`Attendance is at ${child.attendanceRate}% — regular attendance will help improve results.`);
    }
    result[child.name] = parts.join(" ");
  }
  return result;
}

async function callBedrock(
  prompt: string,
  systemPrompt: string,
  maxTokens: number,
): Promise<string> {
  const runtimeClient = getClient();
  const modelId = process.env.BEDROCK_MODEL_ID || DEFAULT_MODEL_ID;

  const messages: Message[] = [
    { role: "user", content: [{ text: prompt }] },
  ];

  const command = new ConverseCommand({
    modelId,
    messages,
    system: [{ text: systemPrompt }],
    inferenceConfig: { maxTokens, temperature: 0.7 },
  });

  const response = await runtimeClient.send(command);
  const text = response.output?.message?.content?.[0]?.text;
  if (!text) throw new Error("Empty response from Bedrock");
  return text.trim();
}
