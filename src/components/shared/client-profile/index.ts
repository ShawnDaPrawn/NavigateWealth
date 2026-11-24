/**
 * Profile sections rendered by BOTH profile editors — the client portal
 * (`components/pages/profile`) and the admin profile viewer
 * (`components/admin/modules/client-management`). Each takes its value and an
 * onChange, and an `audience` where the wording differs, so neither editor's
 * hook or types leak in here.
 */
export { ComplianceDeclarationsCard } from './ComplianceDeclarationsCard';
export { ComplianceIndicatorList, ComplianceReviewCard } from './ComplianceReviewCard';
export { PlanningSection } from './PlanningSection';
export { PostalAddressFields } from './PostalAddressFields';
export { SmokingAlcoholFields, type SmokingAlcoholValue } from './SmokingAlcoholFields';
export { EmployerBenefitsFields, EmployerBenefitsSummary } from './EmployerBenefitsFields';
export type { Audience } from './fieldHelpers';
