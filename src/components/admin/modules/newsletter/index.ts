/**
 * Newsletter Studio — public barrel.
 *
 * Explicit named exports only. Outside consumers (AdminDashboardPage, tests)
 * import from here, never from module internals (§3.1 / depcruise
 * no-outsider-admin-internals).
 */
export { NewsletterModule } from './NewsletterModule';
export { NewsletterSkeleton } from './components/NewsletterSkeleton';
export { useNewsletterCampaignProcessor } from './hooks/useNewsletterCampaignProcessor';
export { newsletterStudioApi } from './api';
export type {
  NewsletterCampaign,
  NewsletterCampaignStats,
  NewsletterDashboardSummary,
  NewsletterListView,
  NewsletterStudioTemplate,
} from './types';
