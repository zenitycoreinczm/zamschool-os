/**
 * Shared create-user conflict messages for admin user POST.
 * Pure helpers only (no Supabase) so routes and unit tests can share them.
 */

export type UserCreateConflict = {
  status: 409;
  error: string;
  field?: "email" | "admissionNumber" | "employeeId" | "profile";
  code:
    | "duplicate_email"
    | "duplicate_student_number"
    | "duplicate_employee_number"
    | "duplicate_profile"
    | "duplicate";
};

/** Map Postgres unique violations (23505) to admin-facing create-user messages. */
export function mapUniqueViolationToUserCreateConflict(
  error: unknown,
): UserCreateConflict | null {
  if (!error || typeof error !== "object") return null;
  const err = error as {
    code?: string;
    message?: string;
    details?: string;
  };
  const code = String(err.code || "");
  const message = String(err.message || "");
  const details = String(err.details || "");
  const blob = `${message} ${details}`.toLowerCase();

  const isUnique =
    code === "23505" ||
    blob.includes("duplicate key") ||
    blob.includes("unique constraint") ||
    blob.includes("already exists");
  if (!isUnique) return null;

  if (
    blob.includes("students_student_number") ||
    blob.includes("students_number_school") ||
    blob.includes("students_admission_school") ||
    blob.includes("(student_number)") ||
    blob.includes("key (student_number)")
  ) {
    return {
      status: 409,
      code: "duplicate_student_number",
      field: "admissionNumber",
      error:
        "That student number is already used in this school. Enter a different number.",
    };
  }

  if (
    blob.includes("teachers_employee_number") ||
    blob.includes("teachers_employee_number_school") ||
    blob.includes("teachers_employee_id_school") ||
    blob.includes("(employee_number)") ||
    blob.includes("key (employee_number)")
  ) {
    return {
      status: 409,
      code: "duplicate_employee_number",
      field: "employeeId",
      error:
        "That employee number is already used in this school. Enter a different number.",
    };
  }

  if (
    blob.includes("profiles_pkey") ||
    blob.includes("profiles_email") ||
    (blob.includes("key (id)=") && blob.includes("profiles")) ||
    blob.includes("key (email)")
  ) {
    return {
      status: 409,
      code: "duplicate_profile",
      field: "email",
      error:
        "A user with this email already exists. Open them in the directory to edit or reset their temporary password.",
    };
  }

  if (blob.includes("auth.users") || blob.includes("users_email")) {
    return {
      status: 409,
      code: "duplicate_email",
      field: "email",
      error:
        "This email is already registered. Use a different email, or open the existing account in the directory.",
    };
  }

  return {
    status: 409,
    code: "duplicate",
    error:
      "This account conflicts with an existing record. Check email, student number, and employee number.",
  };
}

export function duplicateEmailConflict(): UserCreateConflict {
  return {
    status: 409,
    code: "duplicate_email",
    field: "email",
    error:
      "A user with this email already exists. Open them in the directory to edit or reset their temporary password.",
  };
}

export function duplicateStudentNumberConflict(
  admissionNumber: string,
): UserCreateConflict {
  return {
    status: 409,
    code: "duplicate_student_number",
    field: "admissionNumber",
    error: `Student number "${admissionNumber}" is already used in this school. Enter a different number.`,
  };
}

export function duplicateEmployeeNumberConflict(
  employeeId: string,
): UserCreateConflict {
  return {
    status: 409,
    code: "duplicate_employee_number",
    field: "employeeId",
    error: `Employee number "${employeeId}" is already used in this school. Enter a different number.`,
  };
}
