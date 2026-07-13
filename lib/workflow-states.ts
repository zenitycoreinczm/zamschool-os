/**
 * Workflow state definitions for ZamSchool OS.
 *
 * Every system action follows:
 *   Role → Permission → Workflow State → Approval → Final Action → Audit
 *
 * These constants define the canonical state machines for each domain.
 * API routes should validate transitions using `validateWorkflowTransition`.
 */

export const ADMISSION_STATES = [
  "draft",
  "registered",
  "class_assigned",
  "active",
  "withdrawn",
] as const;

export const PAYMENT_STATES = [
  "pending",
  "verified",
  "locked",
  "rejected",
] as const;

export const GRADING_STATES = [
  "draft",
  "submitted",
  "moderated",
  "approved",
  "published",
] as const;

export const DISCIPLINE_STATES = [
  "open",
  "investigating",
  "resolved",
  "escalated",
  "closed",
] as const;

export type AdmissionState = (typeof ADMISSION_STATES)[number];
export type PaymentState = (typeof PAYMENT_STATES)[number];
export type GradingState = (typeof GRADING_STATES)[number];
export type DisciplineState = (typeof DISCIPLINE_STATES)[number];

export type WorkflowDomain = "admission" | "payment" | "grading" | "discipline";

/**
 * Allowed state transitions per domain.
 * Keys are current states; values are the set of states you may move to.
 */
const TRANSITIONS: Record<WorkflowDomain, Record<string, string[]>> = {
  admission: {
    draft: ["registered"],
    registered: ["class_assigned", "withdrawn"],
    class_assigned: ["active", "withdrawn"],
    active: ["withdrawn"],
    withdrawn: [],
  },
  payment: {
    pending: ["verified", "rejected"],
    verified: ["locked"],
    locked: [],
    rejected: [],
  },
  grading: {
    draft: ["submitted"],
    submitted: ["moderated", "draft"],
    moderated: ["approved", "submitted"],
    approved: ["published"],
    published: [],
  },
  discipline: {
    open: ["investigating", "resolved", "escalated", "closed"],
    investigating: ["resolved", "escalated", "closed"],
    resolved: ["closed", "escalated"],
    escalated: ["investigating", "resolved", "closed"],
    closed: [],
  },
};

/**
 * Roles allowed to perform each transition.
 * Empty array means any role with the feature permission may proceed.
 */
const TRANSITION_ROLES: Record<WorkflowDomain, Record<string, string[]>> = {
  admission: {
    "draft→registered": ["REGISTRAR"],
    "registered→class_assigned": ["ACADEMIC_ADMIN"],
    "registered→withdrawn": ["REGISTRAR", "PRINCIPAL"],
    "class_assigned→active": ["PRINCIPAL"],
    "class_assigned→withdrawn": ["REGISTRAR", "PRINCIPAL"],
    "active→withdrawn": ["REGISTRAR", "PRINCIPAL"],
  },
  payment: {
    "pending→verified": ["BURSAR", "PRINCIPAL"],
    "pending→rejected": ["BURSAR", "PRINCIPAL"],
    "verified→locked": ["BURSAR", "PRINCIPAL"],
  },
  grading: {
    "draft→submitted": ["TEACHER"],
    "submitted→moderated": ["ACADEMIC_ADMIN", "DEPUTY_HEAD", "PRINCIPAL"],
    "submitted→draft": ["TEACHER", "ACADEMIC_ADMIN"],
    "moderated→approved": ["DEPUTY_HEAD", "PRINCIPAL"],
    "moderated→submitted": ["ACADEMIC_ADMIN", "DEPUTY_HEAD"],
    "approved→published": ["PRINCIPAL"],
  },
  discipline: {
    "open→investigating": [
      "DISCIPLINE_ADMIN",
      "GUIDANCE_OFFICE",
      "PRINCIPAL",
      "DEPUTY_HEAD",
      ],
    "open→resolved": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "open→escalated": ["DISCIPLINE_ADMIN", "DEPUTY_HEAD", "PRINCIPAL"],
    "open→closed": ["PRINCIPAL"],
    "investigating→resolved": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "investigating→escalated": [
      "DISCIPLINE_ADMIN",
      "DEPUTY_HEAD",
      "PRINCIPAL",
    ],
    "investigating→closed": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "resolved→closed": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "resolved→escalated": [
      "DISCIPLINE_ADMIN",
      "DEPUTY_HEAD",
      "PRINCIPAL",
    ],
    "escalated→investigating": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "escalated→resolved": ["DISCIPLINE_ADMIN", "PRINCIPAL"],
    "escalated→closed": ["PRINCIPAL"],
  },
};

export type WorkflowTransitionResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Validate that a state transition is legal for the given domain.
 */
export function validateWorkflowTransition(
  domain: WorkflowDomain,
  currentState: string,
  newState: string,
): WorkflowTransitionResult {
  const domainTransitions = TRANSITIONS[domain];
  if (!domainTransitions) {
    return { allowed: false, reason: `Unknown workflow domain: ${domain}` };
  }

  const allowedNext = domainTransitions[currentState];
  if (!allowedNext) {
    return {
      allowed: false,
      reason: `Unknown current state '${currentState}' for ${domain} workflow`,
    };
  }

  if (!allowedNext.includes(newState)) {
    return {
      allowed: false,
      reason: `Cannot transition from '${currentState}' to '${newState}' in ${domain} workflow`,
    };
  }

  return { allowed: true };
}

/**
 * Check whether a role is allowed to perform a specific transition.
 * SUPER_ADMIN bypasses workflow transition checks. PRINCIPAL must be listed
 * on the specific approval/escalation transition.
 */
export function canRolePerformTransition(
  domain: WorkflowDomain,
  currentState: string,
  newState: string,
  role: string,
): boolean {
  const normalizedRole = role.toUpperCase();
  if (normalizedRole === "SUPER_ADMIN") {
    return true;
  }

  const key = `${currentState}→${newState}`;
  const roleMap = TRANSITION_ROLES[domain];
  if (!roleMap) return false;

  const allowed = roleMap[key];
  if (!allowed || allowed.length === 0) return false;

  return allowed.includes(normalizedRole);
}

/**
 * Combined check: validates the transition is legal AND the role can perform it.
 */
export function authorizeWorkflowTransition(
  domain: WorkflowDomain,
  currentState: string,
  newState: string,
  role: string,
): WorkflowTransitionResult {
  const transition = validateWorkflowTransition(domain, currentState, newState);
  if (!transition.allowed) return transition;

  if (!canRolePerformTransition(domain, currentState, newState, role)) {
    return {
      allowed: false,
      reason: `Role '${role}' cannot transition ${domain} from '${currentState}' to '${newState}'`,
    };
  }

  return { allowed: true };
}
