export function buildResultNotificationPayloads(input: {
  studentUserId: string;
  studentId: string;
  resultId: string;
  parents: Array<{ id: string }>;
  studentName: string;
  className: string;
  subjectName: string;
  assignmentTitle: string;
  teacherName: string;
  publishedAt: string;
}) {
  const title = `${input.assignmentTitle} result published for ${input.studentName}`;
  const recipientIds = [
    input.studentUserId,
    ...input.parents.map((parent) => parent.id),
  ].filter(Boolean);

  return Array.from(new Set(recipientIds)).map((recipientId) => ({
    user_id: recipientId,
    dedupe_key: `${recipientId}:${input.studentId}:result:${input.resultId}`,
    title,
    message: `${input.teacherName} published ${input.studentName}'s ${input.subjectName} result for ${input.assignmentTitle} (${input.className}) on ${input.publishedAt}.`,
    type: "results",
  }));
}

export function buildExamCertificateNotificationPayloads(input: {
  examTitle: string;
  studentUserId: string;
  studentId: string;
  parents: Array<{ id: string }>;
  studentName: string;
  className: string;
  teacherName: string;
  publishedAt: string;
  subjectCount: number;
}) {
  const title = `${input.examTitle} results published for ${input.studentName}`;
  const recipientIds = [
    input.studentUserId,
    ...input.parents.map((parent) => parent.id),
  ].filter(Boolean);

  return Array.from(new Set(recipientIds)).map((recipientId) => ({
    user_id: recipientId,
    dedupe_key: `${recipientId}:${input.studentId}:exam:${input.examTitle}`,
    title,
    message: `${input.teacherName} published ${input.studentName}'s ${input.examTitle} results (${input.className}) - ${input.subjectCount} subjects. View certificate.`,
    type: "results",
  }));
}
