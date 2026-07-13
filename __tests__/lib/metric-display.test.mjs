import test from "node:test";
import assert from "node:assert/strict";

import {
  formatSchoolStatValue,
  formatSchoolTextField,
  isPlaceholderDash,
  schoolHeroStatsFromSummary,
} from "../../lib/workspace/metric-display.ts";

test("formatSchoolStatValue never returns bare dashes for school counts", () => {
  assert.equal(formatSchoolStatValue(undefined, { loading: true }), "…");
  assert.equal(formatSchoolStatValue(null), "0");
  assert.equal(formatSchoolStatValue("—"), "0");
  assert.equal(formatSchoolStatValue("-"), "0");
  assert.equal(formatSchoolStatValue("12"), "12");
  assert.equal(formatSchoolStatValue(0), "0");
  assert.equal(formatSchoolStatValue("", { kind: "text" }), "Not set");
});

test("formatSchoolTextField uses friendly empty labels", () => {
  assert.equal(formatSchoolTextField(null), "Not set");
  assert.equal(
    formatSchoolTextField("", { emptyLabel: "Not linked" }),
    "Not linked",
  );
  assert.equal(formatSchoolTextField("Sunrise School"), "Sunrise School");
});

test("schoolHeroStatsFromSummary uses live metrics and avoids dashes", () => {
  const live = schoolHeroStatsFromSummary(
    [{ label: "Students", value: "42", hint: "On directory" }],
    [{ label: "Students", hint: "On directory" }],
    false,
  );
  assert.equal(live[0].value, "42");

  const loading = schoolHeroStatsFromSummary(
    [],
    [{ label: "Students", hint: "On directory" }],
    true,
  );
  assert.equal(loading[0].value, "…");

  const empty = schoolHeroStatsFromSummary(
    [],
    [{ label: "Students", hint: "On directory" }],
    false,
  );
  assert.equal(empty[0].value, "0");
  assert.ok(!isPlaceholderDash(empty[0].value));
});
