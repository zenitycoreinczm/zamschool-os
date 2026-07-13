import { z } from "zod";

const ROLE_VALUES = ["teacher", "student", "parent"] as const;

const teacherAssignmentSchema = z.object({
  classId: z.string().min(1),
  subjectId: z.string().min(1),
});

const createUserSchema = z.object({
  role: z.enum(ROLE_VALUES),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  profileExtras: z.record(z.string(), z.any()).optional(),
  parentExtras: z.record(z.string(), z.any()).optional(),
  specializationSubjectIds: z.array(z.string().min(1)).optional(),
  teachingAssignments: z.array(teacherAssignmentSchema).optional(),
  supervisedClassIds: z.array(z.string().min(1)).optional(),
});

const updateUserSchema = z.object({
  profileId: z.string().min(1),
  role: z.enum(["teacher", "student", "parent"]),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  admissionNumber: z.string().optional().nullable(),
  classNumber: z.union([z.number().int().positive(), z.string()]).optional().nullable(),
  classId: z.string().optional().nullable(),
  enrollmentDate: z.string().optional().nullable(),
  employeeId: z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  hireDate: z.string().optional().nullable(),
  relationType: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  specializationSubjectIds: z.array(z.string().min(1)).optional(),
  teachingAssignments: z.array(teacherAssignmentSchema).optional(),
  supervisedClassIds: z.array(z.string().min(1)).optional(),
});

export {
  ROLE_VALUES,
  teacherAssignmentSchema,
  createUserSchema,
  updateUserSchema,
};
