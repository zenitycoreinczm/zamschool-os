"use client";

import { forwardRef } from "react";

export type SubjectResult = {
  name: string;
  code: string;
  score: number;
  grade: string;
  totalMarks: number;
  performance: string;
};

export type StatementOfResultsProps = {
  studentName: string;
  examNumber: string;
  schoolName: string;
  /** Class / grade stream e.g. Grade 9A */
  className?: string;
  examYear: number;
  examTitle: string;
  subjects: SubjectResult[];
  overallGrade: string;
  totalScore: number;
  totalPossible: number;
  average: number;
  position: string;
  classSize: number;
  verificationCode: string;
  publishedAt: string;
  teacherName: string;
};

const performanceColor = (perf: string): string => {
  const p = perf.toLowerCase();
  if (p.includes("outstanding") || p.includes("excellent")) return "#059669";
  if (p.includes("very good")) return "#0d9488";
  if (p.includes("good")) return "#2563eb";
  if (p.includes("satisfactory")) return "#d97706";
  if (p.includes("fair") || p.includes("pass")) return "#ea580c";
  return "#dc2626";
};

const gradeBg = (grade: string): string => {
  const g = grade.toUpperCase();
  if (g === "A+" || g === "A") return "#dcfce7";
  if (g.startsWith("B")) return "#dbeafe";
  if (g.startsWith("C")) return "#fef3c7";
  if (g === "D") return "#fed7aa";
  return "#fee2e2";
};

export const StatementOfResults = forwardRef<HTMLDivElement, StatementOfResultsProps>(
  function StatementOfResults(
    {
      studentName,
      examNumber,
      schoolName,
      className,
      examYear,
      examTitle,
      subjects,
      overallGrade,
      totalScore,
      totalPossible,
      average,
      position,
      classSize,
      verificationCode,
      publishedAt,
      teacherName,
    },
    ref
  ) {
    const overallColor =
      overallGrade === "DISTINCTION"
        ? "#059669"
        : overallGrade === "CREDIT"
          ? "#2563eb"
          : overallGrade === "PASS"
            ? "#d97706"
            : "#dc2626";

    return (
      <div
        ref={ref}
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          background: "white",
          padding: "40px 50px",
          position: "relative",
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          color: "#1a1a1a",
          boxSizing: "border-box",
          boxShadow: "0 10px 40px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-25deg)",
            fontSize: "60px",
            color: "rgba(15,42,67,0.05)",
            fontWeight: 800,
            letterSpacing: "4px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          OFFICIAL RESULTS
        </div>

        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #e5e7eb",
            paddingBottom: "20px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "#0f2a43",
                letterSpacing: "1px",
              }}
            >
              STATEMENT OF RESULTS
            </div>
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              Official school examination certificate · Zambia
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#0f2a43",
                marginTop: "4px",
              }}
            >
              {schoolName}
            </div>
          </div>
          <div
            style={{
              background: "#0f2a43",
              color: "white",
              padding: "6px 12px",
              fontSize: "12px",
              borderRadius: "6px",
              fontWeight: 600,
            }}
          >
            VERIFIED DIGITAL COPY
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            marginTop: "25px",
            gap: "12px",
          }}
        >
          {[
            { label: "Candidate Name", value: studentName },
            { label: "Exam / Candidate No.", value: examNumber },
            { label: "School", value: schoolName },
            { label: "Class / Stream", value: className || "—" },
            { label: "Examination Year", value: String(examYear) },
            {
              label: "Class Position",
              value: position || "—",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "15px",
                background: "#fff",
              }}
            >
              <div style={{ fontSize: "12px", color: "#6b7280" }}>
                {item.label}
              </div>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  marginTop: "4px",
                  color: "#1a1a1a",
                }}
              >
                {item.value || "-"}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "15px",
            padding: "10px 15px",
            background: "#f0f7ff",
            borderRadius: "8px",
            border: "1px solid #bfdbfe",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: "13px", color: "#1e40af", fontWeight: 600 }}>
            {examTitle}
          </div>
          <div style={{ fontSize: "12px", color: "#3b82f6" }}>
            {subjects.length} Subject{subjects.length !== 1 ? "s" : ""}
          </div>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "25px",
            fontSize: "14px",
          }}
        >
          <thead>
            <tr style={{ background: "#0f2a43", color: "white" }}>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                Subject
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                Code
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Score
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                Grade
              </th>
              <th
                style={{
                  padding: "12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                  fontWeight: 600,
                }}
              >
                Performance
              </th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj, idx) => (
              <tr
                key={subj.code || idx}
                style={{
                  background: idx % 2 === 1 ? "#f9fafb" : "white",
                }}
              >
                <td
                  style={{
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    fontWeight: 500,
                  }}
                >
                  {subj.name}
                </td>
                <td style={{ padding: "12px", border: "1px solid #e5e7eb", color: "#6b7280" }}>
                  {subj.code || "-"}
                </td>
                <td
                  style={{
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  {subj.score}/{subj.totalMarks}
                </td>
                <td
                  style={{
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "4px",
                      background: gradeBg(subj.grade),
                    }}
                  >
                    {subj.grade}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px",
                    border: "1px solid #e5e7eb",
                    color: performanceColor(subj.performance),
                    fontWeight: 500,
                  }}
                >
                  {subj.performance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            marginTop: "25px",
            padding: "15px",
            borderLeft: "5px solid #1f6feb",
            background: "#f0f7ff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "15px", color: "#0f2a43" }}>
              Overall Result:{" "}
              <span style={{ color: overallColor }}>{overallGrade}</span>
            </div>
            <div
              style={{ fontSize: "13px", color: "#4b5563", marginTop: "4px" }}
            >
              Total: {totalScore}/{totalPossible} &nbsp;|&nbsp; Average:{" "}
              {average.toFixed(1)}% &nbsp;|&nbsp; Position: {position} of{" "}
              {classSize}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: "40px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #e5e7eb",
            paddingTop: "20px",
            fontSize: "13px",
            color: "#6b7280",
          }}
        >
          <div>
            <div style={{ fontWeight: 600, color: "#374151" }}>
              Verification Code: {verificationCode}
            </div>
            <div style={{ marginTop: "2px" }}>
              Teacher: {teacherName}
            </div>
            <div style={{ marginTop: "2px" }}>
              Date Issued:{" "}
              {new Date(publishedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </div>
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "#e5e7eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              color: "#555",
              borderRadius: "4px",
              textAlign: "center",
              lineHeight: "1.2",
            }}
          >
            QR CODE
          </div>
        </div>
      </div>
    );
  }
);
