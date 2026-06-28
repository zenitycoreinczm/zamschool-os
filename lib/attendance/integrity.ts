export type AttendanceIntegrityCheck = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateAttendancePayload(payload: {
  lessonId: string;
  date: string;
  statuses: Array<{ studentId: string; status: string; remarks?: string | null }>;
}): AttendanceIntegrityCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate lesson ID
  if (!payload.lessonId || typeof payload.lessonId !== "string") {
    errors.push("Invalid lesson ID");
  }

  // Validate date format
  if (!payload.date || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
    errors.push("Invalid date format. Expected YYYY-MM-DD");
  }

  // Validate statuses array
  if (!Array.isArray(payload.statuses) || payload.statuses.length === 0) {
    errors.push("Statuses array is empty or invalid");
  }

  // Check for duplicate student IDs
  const studentIds = payload.statuses.map((s) => s.studentId);
  const uniqueIds = new Set(studentIds);
  if (uniqueIds.size !== studentIds.length) {
    errors.push("Duplicate student IDs detected in payload");
  }

  // Validate each status entry
  const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];
  for (const entry of payload.statuses) {
    if (!entry.studentId || typeof entry.studentId !== "string") {
      errors.push(`Invalid student ID in status entry`);
    }

    if (!entry.status || typeof entry.status !== "string") {
      errors.push(`Missing or invalid status for student ${entry.studentId}`);
    } else if (!validStatuses.includes(entry.status.toUpperCase())) {
      errors.push(`Invalid status "${entry.status}" for student ${entry.studentId}`);
    }

    // Validate remarks length
    if (entry.remarks && typeof entry.remarks === "string" && entry.remarks.length > 500) {
      warnings.push(`Remarks for student ${entry.studentId} exceed 500 characters`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateAttendanceResponse(response: {
  lessonId: string;
  classId: string;
  savedCount: number;
  date: string;
}): AttendanceIntegrityCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!response.lessonId) {
    errors.push("Response missing lesson ID");
  }

  if (!response.classId) {
    errors.push("Response missing class ID");
  }

  if (typeof response.savedCount !== "number" || response.savedCount < 0) {
    errors.push("Invalid saved count in response");
  }

  if (!response.date || !/^\d{4}-\d{2}-\d{2}$/.test(response.date)) {
    errors.push("Invalid date in response");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function compareAttendanceData(
  original: Array<{ studentId: string; status: string }>,
  saved: Array<{ studentId: string; status: string }>
): AttendanceIntegrityCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (original.length !== saved.length) {
    errors.push(`Record count mismatch: original ${original.length}, saved ${saved.length}`);
  }

  const originalMap = new Map(original.map((r) => [r.studentId, r.status]));
  const savedMap = new Map(saved.map((r) => [r.studentId, r.status]));

  for (const [studentId, status] of originalMap.entries()) {
    const savedStatus = savedMap.get(studentId);
    if (!savedStatus) {
      errors.push(`Student ${studentId} missing in saved data`);
    } else if (savedStatus !== status) {
      warnings.push(`Status mismatch for student ${studentId}: original ${status}, saved ${savedStatus}`);
    }
  }

  for (const [studentId] of savedMap.entries()) {
    if (!originalMap.has(studentId)) {
      errors.push(`Unexpected student ${studentId} in saved data`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
