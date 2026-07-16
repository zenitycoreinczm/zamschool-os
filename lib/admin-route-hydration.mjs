export function buildTeacherProfileLookup(input) {
  const teacherIds = Array.isArray(input?.teacherIds) ? input.teacherIds : [];
  const teacherRows = Array.isArray(input?.teacherRows) ? input.teacherRows : [];
  const profileRows = Array.isArray(input?.profileRows) ? input.profileRows : [];

  const teacherRowByAnyId = new Map();
  for (const row of teacherRows) {
    if (row?.id) teacherRowByAnyId.set(row.id, row);
    if (row?.profile_id) teacherRowByAnyId.set(row.profile_id, row);
  }

  const profileById = new Map();
  for (const row of profileRows) {
    if (row?.id) profileById.set(row.id, pickProfile(row));
  }

  const lookup = {};
  for (const teacherId of teacherIds) {
    if (!teacherId) continue;

    const directProfile = profileById.get(teacherId);
    if (directProfile) {
      lookup[teacherId] = directProfile;
      continue;
    }

    const teacherRow = teacherRowByAnyId.get(teacherId);
    const linkedProfile = teacherRow?.profile_id ? profileById.get(teacherRow.profile_id) : null;
    lookup[teacherId] = linkedProfile || null;
  }

  return lookup;
}

export function hydrateTimetableRows(rows, teacherProfileLookup, teacherRows = []) {
  const profileIdByTeacherRowId = new Map();
  for (const teacherRow of Array.isArray(teacherRows) ? teacherRows : []) {
    if (teacherRow?.id && teacherRow?.profile_id) {
      profileIdByTeacherRowId.set(String(teacherRow.id), String(teacherRow.profile_id));
    }
  }

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const teacherId = row?.teacher_id ? String(row.teacher_id) : "";
    const profileFromLookup = teacherId
      ? teacherProfileLookup?.[teacherId] || null
      : null;
    const teacherProfileId =
      (profileFromLookup?.id && String(profileFromLookup.id)) ||
      profileIdByTeacherRowId.get(teacherId) ||
      null;

    return {
      ...row,
      // UI teacher pickers use profile ids; lessons.teacher_id is teachers.id.
      teacher_profile_id: teacherProfileId,
      teacher_row_id: teacherId || null,
      profiles: profileFromLookup,
    };
  });
}

export function hydrateAssignmentRows(rows, teacherProfileLookup) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    teacher: row?.teacher_id ? teacherProfileLookup?.[row.teacher_id] || null : null,
  }));
}

export function hydratePaymentRows(rows, input) {
  const studentProfilesById = input?.studentProfilesById || {};
  const studentAdmissionByProfileId = input?.studentAdmissionByProfileId || {};
  const createdByProfilesById = input?.createdByProfilesById || {};

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const studentProfile = row?.student_id ? studentProfilesById[row.student_id] || null : null;
    const admissionNumber = row?.student_id ? studentAdmissionByProfileId[row.student_id] || null : null;
    const mergedStudent = studentProfile
      ? {
          ...studentProfile,
          admission_number: admissionNumber || studentProfile.admission_number || null,
        }
      : null;

    return {
      ...row,
      profiles: mergedStudent,
      student: mergedStudent,
      created_by_profile: row?.created_by ? createdByProfilesById[row.created_by] || null : null,
    };
  });
}

function pickProfile(row) {
  return {
    id: row.id,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email: row.email || null,
  };
}
