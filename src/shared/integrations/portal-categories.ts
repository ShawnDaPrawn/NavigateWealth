/**
 * Which product categories portal automation can run for.
 *
 * WHY THIS IS HERE AND NOT IMPORTED FROM THE ADMIN MODULE
 * -------------------------------------------------------
 * The client record (`components/admin/profile-sections`) needs this to decide
 * whether to offer a per-policy "refresh from provider" control, but the
 * `no-outsider-admin-internals` boundary rule forbids it importing the
 * product-management module's internals. The documented remedy in
 * `quality/dependency-cruiser.cjs` is to move the shared contract into
 * `src/shared` rather than route around the rule, which is what this is.
 *
 * THREE COPIES EXIST, DELIBERATELY
 * --------------------------------
 * This list, `PORTAL_AUTOMATION_CATEGORY_IDS` in the admin module's types, and
 * `PORTAL_AUTOMATION_CATEGORY_LABELS` on the server. The server's cannot import
 * SPA source (it is Deno), and the admin module's is pinned by the golden-flow
 * suite. `portalCategories.test.ts` asserts all three agree, so they cannot
 * drift apart silently — which is the only real cost of the duplication.
 *
 * @module shared/integrations/portal-categories
 */

/** Categories a portal job may be created for. Parent categories are excluded. */
export const PORTAL_AUTOMATION_CATEGORIES = [
  'risk_planning',
  'medical_aid',
  'retirement_pre',
  'retirement_post',
  'investments_voluntary',
  'investments_guaranteed',
  'employee_benefits',
  'employee_benefits_risk',
  'employee_benefits_retirement',
  'tax_planning',
  'estate_planning',
] as const;

export type PortalAutomationCategory = (typeof PORTAL_AUTOMATION_CATEGORIES)[number];

/**
 * Parent categories. Legacy policy records still carry these while being
 * displayed in a child table, and the server rejects them for portal
 * automation, so anything offering a portal action must exclude them.
 */
export const PORTAL_PARENT_CATEGORIES = ['retirement_planning', 'investments'] as const;

export function isPortalAutomationCategoryId(categoryId: string): boolean {
  return (PORTAL_AUTOMATION_CATEGORIES as readonly string[]).includes(categoryId);
}
