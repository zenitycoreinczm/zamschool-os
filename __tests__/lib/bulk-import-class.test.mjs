import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildManagedAccountPayload,
  normalizeImportRow,
  readClassField,
  resolveClassId,
} from "../../lib/bulk-import-helpers.ts";

const CLASSES = [
  { id: "cls-form-1", name: "Form 1" },
  { id: "cls-form-2", name: "Form 2" },
  { id: "cls-9a", name: "Grade 9A" },
];

describe("bulk import class resolution", () => {
  it("reads class from common CSV headers", () => {
    assert.equal(readClassField({ class: "Form 1" }), "Form 1");
    assert.equal(
      readClassField(normalizeImportRow({ Class: "Form 1" })),
      "Form 1",
    );
    assert.equal(
      readClassField(normalizeImportRow({ class_name: "Form 1" })),
      "Form 1",
    );
  });

  it("resolves class name case-insensitively", () => {
    assert.equal(resolveClassId("form 1", CLASSES), "cls-form-1");
    assert.equal(resolveClassId("FORM 1", CLASSES), "cls-form-1");
    assert.equal(resolveClassId("Form1", CLASSES), "cls-form-1");
    assert.equal(resolveClassId("cls-9a", CLASSES), "cls-9a");
  });

  it("builds student payload with class_id", () => {
    const payload = buildManagedAccountPayload(
      "STUDENT",
      {
        name: "Student 1",
        email: "student1@school.com",
        admission_number: "ADM001",
        gender: "Male",
        status: "Active",
        class: "Form 1",
      },
      CLASSES,
    );

    assert.equal(payload.role, "student");
    assert.equal(payload.profileExtras.class_id, "cls-form-1");
    assert.equal(payload.profileExtras.admission_number, "ADM001");
  });

  it("throws when class is missing or unknown", () => {
    assert.throws(
      () =>
        buildManagedAccountPayload(
          "STUDENT",
          {
            name: "Student 1",
            email: "student1@school.com",
            admission_number: "ADM001",
          },
          CLASSES,
        ),
      /class/i,
    );
    assert.throws(
      () =>
        buildManagedAccountPayload(
          "STUDENT",
          {
            name: "Student 1",
            email: "student1@school.com",
            admission_number: "ADM001",
            class: "Form 99",
          },
          CLASSES,
        ),
      /Form 99/,
    );
  });
});
