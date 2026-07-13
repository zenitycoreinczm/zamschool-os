export type StudentAttendanceSummary = {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  EXCUSED: number;
  total: number;
  rate: number;
};

export type StudentProfile = {
  id: string;
  fullName: string;
  email: string | null;
  admissionNumber: string | null;
  /** Register number within the class (roll call / results). */
  classNumber: number | null;
  className: string | null;
  gradeLabel: string | null;
};

export type StudentLesson = {
  id: string;
  subjectName: string;
  subjectCode: string | null;
  teacherName: string;
  className: string;
  startTime: string | null;
  endTime: string | null;
};

export type StudentAssignmentRow = {
  id: string;
  title: string;
  dueDate: string | null;
  totalMarks: number | null;
  description: string;
  subjectName: string;
  subjectCode: string | null;
  teacherName: string;
  urgent: boolean;
  submissionId: string | null;
  submissionText: string;
  submissionLink: string | null;
  submissionFileUrl: string | null;
  submissionFileName: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  submissionStatus: "pending" | "submitted";
};

export type StudentResultRow = {
  id: string;
  assignmentTitle: string;
  subjectName: string;
  className: string;
  score: number | null;
  grade: string | null;
  published_at: string | null;
};

export type StudentDashboardPayload = {
  profile: StudentProfile;
  todayLessons: StudentLesson[];
  attendance: { summary: StudentAttendanceSummary };
  assignments: {
    total: number;
    urgent: number;
    rows: StudentAssignmentRow[];
  };
};

export type SubmissionFormState = {
  submissionText: string;
  submissionLink: string;
  submissionFile: File | null;
};

export type SubmissionStatus = "pending" | "submitted";
