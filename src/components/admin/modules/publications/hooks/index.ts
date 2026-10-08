/**
 * Publications Feature - Hooks Index
 *
 * Central export for all custom hooks.
 */

// Query key registry
export { newsletterKeys, publicationKeys } from './queryKeys';

// Data fetching hooks
export { useArticles } from './useArticles';
export { useArticle } from './useArticle';
export { useCategories } from './useCategories';
export { useTypes } from './useTypes';

// Form management hooks
export { useArticleForm } from './useArticleForm';

// Action hooks
export { useArticleActions } from './useArticleActions';
export { useDeleteArticles } from './useDeleteArticles';
export type { DeleteArticlesVariables } from './useDeleteArticles';
export { useArchiveArticles } from './useArchiveArticles';
export type { ArchiveArticlesVariables } from './useArchiveArticles';
export { useCategoryActions } from './useCategoryActions';
export { useTypeActions } from './useTypeActions';

// Other hooks
export { NEWS_KEYS, useMarketNews } from './useMarketNews';
export { usePublicationsInit } from './usePublicationsInit';
export { useScheduledPublishProcessor } from './useScheduledPublishProcessor';
export { useAutoContentProcessor } from './useAutoContentProcessor';

// Newsletter hooks
export { useNewsletterSubscribers } from './useNewsletterSubscribers';
export type { SubscriberStats } from './useNewsletterSubscribers';
export {
  useAddSubscriber,
  useBulkUpload,
  useRemoveSubscriber,
  useResubscribe,
  useUpdateSubscriber,
} from './useNewsletterMutations';
