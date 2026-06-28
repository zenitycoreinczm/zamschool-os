export type ConflictResolution = "last-write-wins" | "reject" | "merge";

export interface AttendanceConflictInfo {
  hasConflict: boolean;
  conflictType: "concurrent-edit" | "version-mismatch" | "data-overwrite" | null;
  existingData?: {
    recordedAt: string;
    recordedBy: string;
    status: string;
  };
  resolution: ConflictResolution;
}

export function detectAttendanceConflict(
  existingRecord: { created_at: string | null; recorded_by: string | null; status: string | null } | null,
  newStatus: string,
  currentUserId: string
): AttendanceConflictInfo {
  if (!existingRecord) {
    return {
      hasConflict: false,
      conflictType: null,
      resolution: "last-write-wins",
    };
  }

  // Check if the same user is updating (no conflict)
  if (existingRecord.recorded_by === currentUserId) {
    return {
      hasConflict: false,
      conflictType: null,
      resolution: "last-write-wins",
    };
  }

  // Check if status is the same (no meaningful conflict)
  if (existingRecord.status?.toLowerCase() === newStatus.toLowerCase()) {
    return {
      hasConflict: false,
      conflictType: null,
      resolution: "last-write-wins",
    };
  }

  // Detect concurrent edit within last 5 minutes
  const recordedTime = existingRecord.created_at ? new Date(existingRecord.created_at).getTime() : 0;
  const now = Date.now();
  const isRecentEdit = now - recordedTime < 5 * 60 * 1000; // 5 minutes

  if (isRecentEdit) {
    return {
      hasConflict: true,
      conflictType: "concurrent-edit",
      existingData: {
        recordedAt: existingRecord.created_at || "",
        recordedBy: existingRecord.recorded_by || "",
        status: existingRecord.status || "",
      },
      resolution: "last-write-wins", // Default to last-write-wins for attendance
    };
  }

  // Data overwrite for older records
  return {
    hasConflict: true,
    conflictType: "data-overwrite",
    existingData: {
      recordedAt: existingRecord.created_at || "",
      recordedBy: existingRecord.recorded_by || "",
      status: existingRecord.status || "",
    },
    resolution: "last-write-wins",
  };
}

export function generateConflictMetadata(
  conflictInfo: AttendanceConflictInfo,
  lessonId: string,
  studentId: string
): Record<string, any> {
  if (!conflictInfo.hasConflict) {
    return {};
  }

  return {
    conflict_detected: true,
    conflict_type: conflictInfo.conflictType,
    conflict_resolution: conflictInfo.resolution,
    lesson_id: lessonId,
    student_id: studentId,
    previous_recorded_by: conflictInfo.existingData?.recordedBy,
    previous_recorded_at: conflictInfo.existingData?.recordedAt,
    previous_status: conflictInfo.existingData?.status,
    conflict_timestamp: new Date().toISOString(),
  };
}
