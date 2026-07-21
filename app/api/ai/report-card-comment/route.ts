import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTeacherContext } from "@/lib/server-auth";
import {
  applyRateLimit,
  getClientIp,
  parseJsonWithSchema,
  safeErrorMessage,
} from "@/lib/server-guards";
import {
  generateReportCardComment,
  type StudentDataForComment,
} from "@/lib/ai/bedrock";

const subjectSchema = z.object({
  name: z.string().trim().min(1),
  score: z.number().finite().nullable().optional(),
  maxScore: z.number().finite().nullable().optional(),
  grade: z.string().trim().nullable().optional(),
});

const generateSchema = z.object({
  studentName: z.string().trim().min(1),
  className: z.string().trim().min(1),
  termName: z.string().trim().min(1),
  subjects: z.array(subjectSchema).min(1),
  attendanceRate: z.number().finite().min(0).max(100).nullable().optional(),
  flags: z.array(z.string()).optional(),
  riskLevel: z.enum(["low", "medium", "high"]).optional(),
});

export async function POST(req: Request) {
  try {
    const access = await requireTeacherContext(req);
    if (!access.ok) return access.response;

    const { userId, schoolId } = access.context;
    if (!schoolId) {
      return NextResponse.json(
        { error: "No school linked to this account" },
        { status: 403 },
      );
    }

    const ip = getClientIp(req);
    const rate = await applyRateLimit({
      key: `ai-report-card-comment:${userId}:${ip}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const body = await parseJsonWithSchema(req, generateSchema);

    const studentData: StudentDataForComment = {
      studentName: body.studentName,
      className: body.className,
      termName: body.termName,
      subjects: body.subjects.map((s) => ({
        name: s.name,
        score: s.score ?? null,
        maxScore: s.maxScore ?? null,
        grade: s.grade ?? null,
      })),
      attendanceRate: body.attendanceRate ?? null,
      flags: body.flags ?? [],
      riskLevel: body.riskLevel ?? "low",
    };

    const comment = await generateReportCardComment(studentData);

    return NextResponse.json({ success: true, data: { comment } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: safeErrorMessage(error, "Failed to generate comment") },
      { status: 500 },
    );
  }
}
