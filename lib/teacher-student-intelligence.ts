import { buildDisplayName } from "./teacher-route-common";
import { loadTeacherAssignmentScope } from "./teacher-assignment-scope-server";
import { supabaseAdmin } from "./supabase";

export type TeacherStudentRiskLevel = "low" | "medium" | "high";

export type TeacherStudentResultSummary = {
  id: string;
  assessmentType: string;
  date: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  remarks: string | null;
};

export type TeacherStudentIntelligenceRow = {
  id: string;
  profileId: string | null;
  contactId: string;
  classId: string;
  className: string;
  admissionNumber: string | null;
  displayName: string;
  email: string | null;
  attendance: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
  };
  results: {
    total: number;
    averageScore: number | null;
    lowScoreCount: number;
    recent: TeacherStudentResultSummary[];
  };
  flags: string[];
  riskLevel: TeacherStudentRiskLevel;
};

export type TeacherClassHealthSummary = {
  id: string;
  name: string;
  studentCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  averageAttendanceRate: number | null;
  averageScore: number | null;
};

export type TeacherStudentIntelligencePayload = {
  students: TeacherStudentIntelligenceRow[];
  classHealth: TeacherClassHealthSummary[];
  summary: {
    totalStudents: number;
    classes: number;
    highRiskStudents: number;
    mediumRiskStudents: number;
  };
};

type NormalizedStudentRow = {
  id: string;
  profileId: string | null;
  classId: string;
  admissionNumber: string | null;
  displayName: string;
  email: string | null;
};

type AttendanceAggregate = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
};

type RawResultRow = {
  id: string;
  student_id: string | null;
  assessment_type: string | null;
  score: number | string | null;
  max_score: number | string | null;
  date: string | null;
  remarks: string | null;
  created_at: string | null;
};

export async function loadTeacherStudentIntelligence(input: {
  schoolId: string;
  actorProfileId: string;
}): Promise<TeacherStudentIntelligencePayload> {
  const assignmentScope = await loadTeacherAssignmentScope({
    schoolId: input.schoolId,
    actorProfileId: input.actorProfileId,
  });

  if (assignmentScope.allowedClassIds.length === 0) {
    return {
      students: [],
      classHealth: [],
      summary: {
        totalStudents: 0,
        classes: 0,
        highRiskStudents: 0,
        mediumRiskStudents: 0,
      },
    };
  }

  const [classMap, students] = await Promise.all([
    loadClassesById(input.schoolId, assignmentScope.allowedClassIds),
    loadStudentsByClassIds(input.schoolId, assignmentScope.allowedClassIds),
  ]);

  if (students.length === 0) {
    return {
      students: [],
      classHealth: [],
      summary: {
        totalStudents: 0,
        classes: classMap.size,
        highRiskStudents: 0,
        mediumRiskStudents: 0,
      },
    };
  }

  const studentKeyByIdentity = new Map<string, string>();
  const studentIdentityKeys = new Set<string>();
  for (const student of students) {
    studentKeyByIdentity.set(student.id, student.id);
    studentIdentityKeys.add(student.id);

    if (student.profileId) {
      studentKeyByIdentity.set(student.profileId, student.id);
      studentIdentityKeys.add(student.profileId);
    }
  }

  const [attendanceRows, resultRows] = await Promise.all([
    loadAttendanceRows(
      input.schoolId,
      assignmentScope.allowedClassIds,
      Array.from(studentIdentityKeys),
    ),
    loadResultRows(input.schoolId, Array.from(studentIdentityKeys)),
  ]);

  const attendanceByStudent = new Map<string, AttendanceAggregate>();
  const resultsByStudent = new Map<string, TeacherStudentResultSummary[]>();

  for (const student of students) {
    attendanceByStudent.set(student.id, {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    });
    resultsByStudent.set(student.id, []);
  }

  for (const row of attendanceRows) {
    const studentKey = studentKeyByIdentity.get(
      String(row.student_id || "").trim(),
    );
    if (!studentKey) continue;

    const bucket = attendanceByStudent.get(studentKey);
    if (!bucket) continue;

    bucket.total += 1;
    switch (
      String(row.status || "")
        .trim()
        .toUpperCase()
    ) {
      case "PRESENT":
        bucket.present += 1;
        break;
      case "ABSENT":
        bucket.absent += 1;
        break;
      case "LATE":
        bucket.late += 1;
        break;
      case "EXCUSED":
        bucket.excused += 1;
        break;
      default:
        break;
    }
  }

  for (const row of resultRows) {
    const studentKey = studentKeyByIdentity.get(
      String(row.student_id || "").trim(),
    );
    if (!studentKey) continue;

    const bucket = resultsByStudent.get(studentKey);
    if (!bucket) continue;

    const score = normalizeNumericValue(row.score);
    const maxScore = normalizeNumericValue(row.max_score);
    bucket.push({
      id: row.id,
      assessmentType: String(row.assessment_type || "Assessment"),
      date: row.date || row.created_at || null,
      score,
      maxScore,
      percentage: toPercentage(score, maxScore),
      remarks: row.remarks || null,
    });
  }

  const studentsWithSignals = students.map((student) => {
    const attendance = attendanceByStudent.get(student.id) || {
      total: 0,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    const recentResults = (resultsByStudent.get(student.id) || [])
      .sort((left, right) =>
        String(right.date || "").localeCompare(String(left.date || "")),
      )
      .slice(0, 4);
    const allResults = resultsByStudent.get(student.id) || [];
    const allScoredPercentages = allResults
      .map((row) => row.percentage)
      .filter((value): value is number => typeof value === "number");
    const averageScore =
      allScoredPercentages.length > 0
        ? Math.round(
            allScoredPercentages.reduce((sum, value) => sum + value, 0) /
              allScoredPercentages.length,
          )
        : null;
    const attendanceRate =
      attendance.total > 0
        ? Math.round(
            ((attendance.present + attendance.late + attendance.excused) /
              attendance.total) *
              100,
          )
        : null;
    const lowScoreCount = allScoredPercentages.filter(
      (value) => value < 50,
    ).length;
    const flags = buildStudentFlags({
      attendanceRate,
      absentCount: attendance.absent,
      lateCount: attendance.late,
      averageScore,
      resultCount: allResults.length,
      lowScoreCount,
    });

    return {
      id: student.id,
      profileId: student.profileId,
      contactId: student.profileId || student.id,
      classId: student.classId,
      className: classMap.get(student.classId) || "Class",
      admissionNumber: student.admissionNumber,
      displayName: student.displayName,
      email: student.email,
      attendance: {
        ...attendance,
        rate: attendanceRate,
      },
      results: {
        total: allResults.length,
        averageScore,
        lowScoreCount,
        recent: recentResults,
      },
      flags,
      riskLevel: deriveRiskLevel(flags),
    } satisfies TeacherStudentIntelligenceRow;
  });

  const classHealth = buildClassHealth(studentsWithSignals);

  return {
    students: studentsWithSignals,
    classHealth,
    summary: {
      totalStudents: studentsWithSignals.length,
      classes: classHealth.length,
      highRiskStudents: studentsWithSignals.filter(
        (student) => student.riskLevel === "high",
      ).length,
      mediumRiskStudents: studentsWithSignals.filter(
        (student) => student.riskLevel === "medium",
      ).length,
    },
  };
}

async function loadStudentsByClassIds(schoolId: string, classIds: string[]) {
  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, profile_id, class_id, school_id, student_number")
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .order("student_number", { ascending: true });

  if (!studentError) {
    const profileIds = uniqueValues(
      (studentRows || [])
        .map((row: any) => row.profile_id)
        .filter(isNonEmptyString),
    );
    const profileMap = await loadProfilesByIds(profileIds);

    return (studentRows || [])
      .filter((row: any) => isNonEmptyString(row.class_id))
      .map((row: any) => {
        const profile =
          profileMap.get(String(row.profile_id || "").trim()) || null;
        return {
          id: String(row.id),
          profileId: row.profile_id || null,
          classId: String(row.class_id),
          admissionNumber: row.student_number || null,
          displayName: buildDisplayName(profile, "Student"),
          email: profile?.email || null,
        } satisfies NormalizedStudentRow;
      });
  }

  if (!isSchemaCompatibilityError(studentError)) {
    throw studentError;
  }

  const { data: profileRows, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, class_id, first_name, last_name, email, role, admission_number",
    )
    .eq("school_id", schoolId)
    .in("role", ["STUDENT", "student"])
    .in("class_id", classIds)
    .order("first_name", { ascending: true });

  if (profileError) throw profileError;

  return (profileRows || [])
    .filter((row: any) => isNonEmptyString(row.class_id))
    .map((row: any) => ({
      id: String(row.id),
      profileId: row.id || null,
      classId: String(row.class_id),
      admissionNumber: row.admission_number || null,
      displayName: buildDisplayName(row, "Student"),
      email: row.email || null,
    }));
}

async function loadProfilesByIds(profileIds: string[]) {
  if (profileIds.length === 0) {
    return new Map<
      string,
      { id: string; email: string | null } & Record<string, unknown>
    >();
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", profileIds);

  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function loadAttendanceRows(
  schoolId: string,
  classIds: string[],
  studentIdentityKeys: string[],
) {
  if (classIds.length === 0 || studentIdentityKeys.length === 0) {
    return [];
  }

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 90);
  const minDate = fromDate.toISOString().slice(0, 10);

  const modern = await supabaseAdmin
    .from("attendance")
    .select("student_id, status, class_id, date")
    .eq("school_id", schoolId)
    .in("class_id", classIds)
    .gte("date", minDate);

  if (!modern.error) {
    return modern.data || [];
  }

  const fallback = await supabaseAdmin
    .from("attendance")
    .select("student_id, status, date")
    .eq("school_id", schoolId)
    .in("student_id", studentIdentityKeys)
    .gte("date", minDate);

  if (!fallback.error) {
    return fallback.data || [];
  }

  const legacyDateFallback = await supabaseAdmin
    .from("attendance")
    .select("student_id, status, attendance_date")
    .eq("school_id", schoolId)
    .in("student_id", studentIdentityKeys)
    .gte("attendance_date", minDate);

  if (!legacyDateFallback.error) {
    return (legacyDateFallback.data || []).map((row: any) => ({
      ...row,
      date: row.attendance_date || null,
    }));
  }

  throw legacyDateFallback.error || fallback.error || modern.error;
}

async function loadResultRows(schoolId: string, studentIdentityKeys: string[]) {
  if (studentIdentityKeys.length === 0) {
    return [] as RawResultRow[];
  }

  // Query the columns that actually exist on the results table:
  // id, student_id, score, grade, remarks, created_at, assessment_name
  const { data, error } = await supabaseAdmin
    .from("results")
    .select(
      "id, student_id, score, grade, remarks, created_at, assessment_name",
    )
    .eq("school_id", schoolId)
    .in("student_id", studentIdentityKeys)
    .order("created_at", { ascending: false });

  if (error) {
    if (!isSchemaCompatibilityError(error)) throw error;
    // If schema is incompatible, return empty - the caller handles it gracefully
    return [] as RawResultRow[];
  }

  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    student_id: row.student_id,
    assessment_type: row.assessment_name || "Assessment",
    score: row.score ?? null,
    max_score: null, // results table does not have max_score; caller defaults to 100
    date: row.created_at || null,
    remarks: row.remarks || null,
    created_at: row.created_at || null,
  })) as RawResultRow[];
}

async function loadClassesById(schoolId: string, classIds: string[]) {
  const legacy = await supabaseAdmin
    .from("classes")
    .select("id, name, grade_level")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (!legacy.error) {
    return new Map(
      (legacy.data || []).map((row: any) => [
        String(row.id),
        buildClassLabel(row),
      ]),
    );
  }

  const modern = await supabaseAdmin
    .from("classes")
    .select("id, name, grades(name, level)")
    .eq("school_id", schoolId)
    .in("id", classIds);

  if (modern.error) throw modern.error;

  return new Map(
    (modern.data || []).map((row: any) => [
      String(row.id),
      buildClassLabel(row),
    ]),
  );
}

function buildStudentFlags(input: {
  attendanceRate: number | null;
  absentCount: number;
  lateCount: number;
  averageScore: number | null;
  resultCount: number;
  lowScoreCount: number;
}) {
  const flags: string[] = [];

  if (input.resultCount === 0) {
    flags.push("No graded work yet");
  }

  if (input.absentCount >= 3) {
    flags.push("Frequent absence");
  } else if (input.absentCount > 0) {
    flags.push("Attendance watch");
  }

  if (input.lateCount >= 3) {
    flags.push("Frequent lateness");
  }

  if (input.attendanceRate != null && input.attendanceRate < 75) {
    flags.push("Low attendance");
  }

  if (input.averageScore != null && input.averageScore < 50) {
    flags.push("Low performance");
  } else if (input.averageScore != null && input.averageScore < 65) {
    flags.push("Performance watch");
  }

  if (input.lowScoreCount >= 2) {
    flags.push("Repeated low scores");
  }

  return uniqueValues(flags);
}

function deriveRiskLevel(flags: string[]): TeacherStudentRiskLevel {
  if (
    flags.includes("Low attendance") ||
    flags.includes("Low performance") ||
    flags.includes("Repeated low scores")
  ) {
    return "high";
  }

  if (
    flags.includes("Attendance watch") ||
    flags.includes("Performance watch") ||
    flags.includes("Frequent lateness")
  ) {
    return "medium";
  }

  return "low";
}

function buildClassHealth(students: TeacherStudentIntelligenceRow[]) {
  const grouped = new Map<string, TeacherStudentIntelligenceRow[]>();

  for (const student of students) {
    const rows = grouped.get(student.classId) || [];
    rows.push(student);
    grouped.set(student.classId, rows);
  }

  return Array.from(grouped.entries()).map(([classId, rows]) => {
    const attendanceRates = rows
      .map((student) => student.attendance.rate)
      .filter((value): value is number => typeof value === "number");
    const averageScores = rows
      .map((student) => student.results.averageScore)
      .filter((value): value is number => typeof value === "number");

    return {
      id: classId,
      name: rows[0]?.className || "Class",
      studentCount: rows.length,
      highRiskCount: rows.filter((student) => student.riskLevel === "high")
        .length,
      mediumRiskCount: rows.filter((student) => student.riskLevel === "medium")
        .length,
      averageAttendanceRate:
        attendanceRates.length > 0
          ? Math.round(
              attendanceRates.reduce((sum, value) => sum + value, 0) /
                attendanceRates.length,
            )
          : null,
      averageScore:
        averageScores.length > 0
          ? Math.round(
              averageScores.reduce((sum, value) => sum + value, 0) /
                averageScores.length,
            )
          : null,
    } satisfies TeacherClassHealthSummary;
  });
}

function normalizeNumericValue(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toPercentage(score: number | null, maxScore: number | null) {
  if (score == null || maxScore == null || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 100);
}

function buildClassLabel(classRow: any) {
  const gradeLevel = classRow?.grade_level ?? classRow?.grades?.level ?? null;
  const gradeName = classRow?.grades?.name ?? null;
  const className = String(classRow?.name || "").trim();

  if (gradeLevel != null && className) {
    return `Grade ${gradeLevel} - ${className}`;
  }

  if (gradeName && className) {
    return `${gradeName} - ${className}`;
  }

  return className || gradeName || "Class";
}

function isSchemaCompatibilityError(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();

  if (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205"
  ) {
    return true;
  }

  return (
    message.includes("does not exist") ||
    message.includes("could not find the") ||
    (message.includes("column") && message.includes("not found"))
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
