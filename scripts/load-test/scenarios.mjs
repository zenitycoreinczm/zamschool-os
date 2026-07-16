/**
 * Load test scenarios - paths and methods only (auth via env in runner).
 */

/** @typedef {{ id: string, method: string, path: string, auth?: boolean, body?: object }} LoadScenario */

/** @type {LoadScenario[]} */
export const SCENARIOS = [
  { id: "public_pages", method: "GET", path: "/login" },
  { id: "public_pages", method: "GET", path: "/register" },
  { id: "public_api", method: "GET", path: "/api/health" },
  { id: "account_read", method: "GET", path: "/api/account/workspace-context", auth: true },
  { id: "account_read", method: "GET", path: "/api/account/unread-summary", auth: true },
  { id: "teacher_bootstrap", method: "GET", path: "/api/teacher/bootstrap", auth: true },
  { id: "admin_dashboard", method: "GET", path: "/api/dashboard/summary", auth: true },
  { id: "admin_dashboard", method: "GET", path: "/api/admin/attendance/summary", auth: true },
];

export function groupScenariosById() {
  /** @type {Map<string, LoadScenario[]>} */
  const map = new Map();
  for (const scenario of SCENARIOS) {
    const list = map.get(scenario.id) || [];
    list.push(scenario);
    map.set(scenario.id, list);
  }
  return map;
}