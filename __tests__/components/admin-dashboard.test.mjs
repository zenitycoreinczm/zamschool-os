import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "components");

test("admin dashboard widgets read live data instead of baked-in demo placeholders", async () => {
  const [userCard, countChart, attendanceChart, financeChart, eventCalendar, announcements] = await Promise.all([
    readFile(resolve(root, "UserCard.tsx"), "utf8"),
    readFile(resolve(root, "CountChart.tsx"), "utf8"),
    readFile(resolve(root, "AttendanceChart.tsx"), "utf8"),
    readFile(resolve(root, "FinanceChart.tsx"), "utf8"),
    readFile(resolve(root, "EventCalendar.tsx"), "utf8"),
    readFile(resolve(root, "Announcements.tsx"), "utf8"),
  ]);

  assert.doesNotMatch(userCard, /2024\/25/);

  assert.doesNotMatch(countChart, /\b55\b/);
  assert.doesNotMatch(countChart, /\b45\b/);
  assert.match(countChart, /fetchDashboardSummary|useDashboardSummary/);
  assert.match(countChart, /unspecified/i);

  assert.doesNotMatch(attendanceChart, /present:\s*60/);
  assert.match(attendanceChart, /\/api\/admin\/attendance\/summary/);

  assert.doesNotMatch(financeChart, /income:\s*4000/);
  assert.match(financeChart, /from\("payments"\)|from\("finance_entries"\)|resolveTable|\/api\/admin\/payments/);
  assert.match(financeChart, /view=chart/);

  assert.doesNotMatch(eventCalendar, /Lake Trip/);
  assert.match(eventCalendar, /\/api\/admin\/events/);
  assert.match(eventCalendar, /\/app\/events/);
  assert.match(announcements, /\/app\/announcements/);
});
