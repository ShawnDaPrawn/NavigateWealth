/**
 * Admin dashboard statistics — shared contract (§9.3).
 *
 * This shape is produced by the edge function's /admin/stats route and consumed
 * by the SPA's dashboard hooks. It was defined twice — once in the edge
 * function's types.ts and once, narrower, in the applications module — which is
 * exactly the drift §9.3 exists to prevent. The edge definition is canonical
 * (it is what the route actually returns), so it lives here and both sides
 * re-export it.
 */
export interface ApplicationStats {
  total: number;
  submitted_for_review: number;
  approved: number;
  declined: number;
  application_in_progress: number;
  invited?: number;
  /** Signups that have not submitted — `draft` count only */
  draft: number;
  /** `draft` + `in_progress` (incomplete onboarding) */
  incomplete: number;
  no_application: number;
  new_applications_7d: number;
  new_this_month: number;
  new_last_month: number;
  // Task statistics
  new_tasks: number;
  pending_tasks: number;
  // Request statistics
  pending_requests: number;
  total_requests: number;
  // E-Signature statistics
  pending_esignatures: number;
  // User statistics
  active_users: number;
  total_clients: number;
}
