import test from "node:test";
import assert from "node:assert/strict";

import {
  detectCsvDelimiter,
  findHeaderRowIndex,
  normalizeHeader,
  parseMarksValue,
  parseResultsGrid,
} from "../../lib/results/sheet-parse.ts";
import {
  buildStudentMatchIndex,
  matchSheetRowToStudent,
} from "../../lib/results/match-students.ts";

test("normalizeHeader handles class number headers", () => {
  assert.equal(normalizeHeader("Class Number"), "class_number");
  assert.equal(normalizeHeader("Class No."), "class_no");
  assert.equal(normalizeHeader("Roll No"), "roll_no");
});

test("parseMarksValue accepts percent and fraction forms", () => {
  assert.equal(parseMarksValue("75"), 75);
  assert.equal(parseMarksValue("75%"), 75);
  assert.equal(parseMarksValue("80/100"), 80);
});

test("findHeaderRowIndex skips title rows", () => {
  const grid = [
    ["ZamSchool Mid-Term Results 2026", "", ""],
    ["", "", ""],
    ["Class Number", "Name", "Marks"],
    ["1", "Alice Banda", "88"],
  ];
  assert.equal(findHeaderRowIndex(grid), 2);
});

test("parseResultsGrid reads Class Number + Name + Marks", () => {
  const grid = [
    ["Grade 7 Science"],
    ["Class Number", "Name", "Marks", "Grade"],
    ["1", "John Phiri", "72", "B"],
    ["2", "Mary Zulu", "91%", "A"],
  ];
  const parsed = parseResultsGrid(grid);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].classNumber, 1);
  assert.equal(parsed.rows[0].name, "John Phiri");
  assert.equal(parsed.rows[0].marks, 72);
  assert.ok(parsed.foundClassNumberColumn);
});

test("match prefers class number over duplicate names", () => {
  const students = [
    {
      id: "s1",
      classId: "c1",
      classNumber: 1,
      admissionNumber: "A1",
      displayName: "John Phiri",
    },
    {
      id: "s2",
      classId: "c1",
      classNumber: 2,
      admissionNumber: "A2",
      displayName: "John Phiri",
    },
  ];
  const index = buildStudentMatchIndex(students);

  const m1 = matchSheetRowToStudent(
    { classNumber: 1, name: "John Phiri" },
    index,
  );
  assert.equal(m1.student?.id, "s1");
  assert.equal(m1.method, "class_number");

  const m2 = matchSheetRowToStudent(
    { classNumber: 2, name: "John Phiri" },
    index,
  );
  assert.equal(m2.student?.id, "s2");

  const ambiguous = matchSheetRowToStudent({ name: "John Phiri" }, index);
  assert.equal(ambiguous.student, null);
  assert.equal(ambiguous.ambiguous, true);
});

test("detectCsvDelimiter prefers semicolon when consistent", () => {
  const text = "Class Number;Name;Marks\n1;Alice;80\n2;Bob;70\n";
  assert.equal(detectCsvDelimiter(text), ";");
});
