import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  biweeklyPeriodId,
  biweeklyPeriodLabel,
  buildSchoolBackupPdf,
} from "../../lib/school-backup-snapshot.ts";

describe("school-backup-snapshot", () => {
  it("builds stable biweekly period ids", () => {
    const a = biweeklyPeriodId(0);
    const b = biweeklyPeriodId(13 * 24 * 60 * 60 * 1000);
    const c = biweeklyPeriodId(14 * 24 * 60 * 60 * 1000);
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.match(a, /^bw-\d+$/);
  });

  it("labels periods with a range", () => {
    const label = biweeklyPeriodLabel("bw-0");
    assert.ok(label.includes("–") || label.includes("-"));
  });

  it("emits a PDF that starts with %PDF", () => {
    const pdf = buildSchoolBackupPdf({
      schoolId: "school-1",
      schoolName: "Lusaka Demo School",
      periodId: "bw-1",
      periodLabel: "Test period",
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      metrics: {
        total: 100,
        student: 80,
        teacher: 10,
        parent: 40,
        staff: 12,
        classCount: 8,
        subjectCount: 12,
        assignmentCount: 20,
        pendingInvites: 1,
        attendancePresentRate: 92,
        attendanceAbsent: 3,
        financeCollected: 1000,
        financePending: 200,
        auditCount7d: 5,
      },
    });
    const head = new TextDecoder().decode(pdf.slice(0, 5));
    assert.equal(head, "%PDF-");
    assert.ok(pdf.byteLength > 200);
  });
});
