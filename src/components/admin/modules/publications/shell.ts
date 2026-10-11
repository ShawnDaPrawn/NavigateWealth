/**
 * Shell entry — what the admin frame needs from this module before the
 * module itself is opened. Keep it to light, side-effect-free re-exports: see
 * the "Shell entries" note in
 * `src/components/admin/moduleLoaders.ts`.
 */
export { PublicationsSkeleton } from './components/PublicationsSkeleton';
export { useArticleNotificationProcessor } from './hooks/useArticleNotificationProcessor';
export { useAutoContentProcessor } from './hooks/useAutoContentProcessor';
export { useScheduledPublishProcessor } from './hooks/useScheduledPublishProcessor';
