import test from "node:test";
import assert from "node:assert/strict";

import {
  detectCsvDelimiter,
  findHeaderRowIndex,
  normalizeHeader,
  parseMarksValue,
  parseResultsGrid,
  parseSheetRows,
} from "../../lib/results/sheet-parse.ts";

test("normalizeHeader handles spaces, BOM, and punctuation", () => {
  assert.equal(normalizeHeader("\uFEFFExam Number"), "exam_number");
  assert.equal(normalizeHeader("Admission No."), "admission_no");
  assert.equal(normalizeHeader("Marks %"), "marks");
  assert.equal(normalizeHeader("S/N"), "s_n");
});

test("parseMarksValue accepts percent and fraction forms", () => {
  assert.equal(parseMarksValue("75"), 75);
  assert.equal(parseMarksValue("75%"), 75);
  assert.equal(parseMarksValue("80/100"), 80);
  assert.equal(parseMarksValue("12.5"), 12.5);
  assert.equal(parseMarksValue("abc"), null);
});

test("findHeaderRowIndex skips title rows", () => {
  const grid = [
    ["ZamSchool Mid-Term Results 2026", "", ""],
    ["", "", ""],
    ["Admission No", "Name", "Marks"],
    ["A001", "Alice Banda", "88"],
  ];
  assert.equal(findHeaderRowIndex(grid), 2);
});

test("parseResultsGrid reads common school sheet with title row", () => {
  const grid = [
    ["Grade 7 Science — Mid Term"],
    ["Admission No", "Student Name", "Score", "Grade"],
    ["STU-001", "John Phiri", "72", "B"],
    ["STU-002", "Mary Zulu", "91%", "A"],
  ];
  const parsed = parseResultsGrid(grid);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].identifier, "STU-001");
  assert.equal(parsed.rows[0].marks, 72);
  assert.equal(parsed.rows[1].marks, 91);
});

test("parseResultsGrid accepts name-only sheets", () => {
  const grid = [
    ["Name", "Marks"],
    ["Chanda Mwansa", "55"],
    ["Bwalya Tembo", "60"],
  ];
  const parsed = parseResultsGrid(grid);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].identifier, "Chanda Mwansa");
});

test("parseResultsGrid handles headerless data rows", () => {
  const grid = [
    ["STU-001", "Alice Banda", "88"],
    ["STU-002", "John Phiri", "72"],
  ];
  const parsed = parseResultsGrid(grid);
  assert.ok(parsed.rows.length >= 2, `expected >=2 rows, got ${parsed.rows.length}`);
  assert.ok(parsed.rows.some((r) => r.identifier.includes("STU") || r.identifier.includes("Alice")));
  assert.ok(parsed.rows.some((r) => r.marks != null));
});

test("parseResultsGrid handles semicolon CSV-style rows", () => {
  // Already split grid (delimiter handled before grid parse)
  const grid = [
    ["Exam No", "Marks"],
    ["EX-9", "40"],
    ["EX-10", "50"],
  ];
  const parsed = parseResultsGrid(grid);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].marks, 40);
});

test("detectCsvDelimiter prefers semicolon when consistent", () => {
  const text = "Admission No;Name;Marks\nA1;Alice;80\nA2;Bob;70\n";
  assert.equal(detectCsvDelimiter(text), ";");
});

test("parseSheetRows still works for object maps", () => {
  const objects = [
    { exam_no: "EX-9", mark: "40" },
    { exam_no: "EX-10", mark: "50" },
  ];
  const parsed = parseSheetRows(objects);
  assert.equal(parsed.rows.length, 2);
});
